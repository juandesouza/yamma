import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
  ForbiddenException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { ConfigService } from '../config/config.service';
import { SessionGuard } from './guards/session.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { SessionUser } from './auth.types';
import { z } from 'zod';
import { isGuestUserEmail } from './guest.constants';
import { sign, verify } from 'jsonwebtoken';
import * as nodemailer from 'nodemailer';

const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(8),
}).refine((d) => !!d.email || !!d.phone, { message: 'email or phone required' });

const registerSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(10).optional(),
    name: z.string().min(2),
    password: z.string().min(8),
    accountType: z.enum(['buyer', 'seller']).default('buyer'),
  })
  .refine((d) => !!d.email || !!d.phone, { message: 'email or phone required' });

const guestSessionSchema = z.object({
  role: z.enum(['buyer', 'seller']).optional(),
});

const googleExchangeSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
});

const googleIdTokenSchema = z.object({
  idToken: z.string().min(20),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
});

/** Rethrow when duplicate @nestjs/common breaks `instanceof BadRequestException`. */
function isNestHttpExceptionShape(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { getStatus?: unknown }).getStatus === 'function'
  );
}

function formatUnknownError(e: unknown, depth = 0): string {
  if (depth > 5) return '(nested error, depth limit)';
  if (e === null || e === undefined) return String(e);
  if (typeof e === 'string') return e;
  if (e instanceof Error) {
    const withErrors = e as Error & { errors?: unknown[] };
    if (Array.isArray(withErrors.errors) && withErrors.errors.length > 0) {
      const nested = withErrors.errors
        .map((sub) => formatUnknownError(sub, depth + 1))
        .filter(Boolean);
      if (nested.length) {
        const head = [e.name && e.name !== 'Error' ? e.name : '', e.message?.trim()]
          .filter(Boolean)
          .join(': ');
        return head ? `${head} — ${nested.join(' | ')}` : nested.join(' | ');
      }
    }
    const bits: string[] = [];
    if (e.name && e.name !== 'Error') bits.push(e.name);
    if (e.message?.trim()) bits.push(e.message.trim());
    const cause = (e as Error & { cause?: unknown }).cause;
    if (cause !== undefined && cause !== e) {
      const inner = formatUnknownError(cause, depth + 1);
      if (inner) bits.push(`cause: ${inner}`);
    }
    return bits.length ? bits.join(' — ') : '(Error with empty message)';
  }
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
    if (typeof o.detail === 'string' && o.detail.trim()) return o.detail.trim();
    try {
      return JSON.stringify(o);
    } catch {
      return Object.prototype.toString.call(e);
    }
  }
  return String(e);
}

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private users: UsersService,
    private restaurants: RestaurantsService,
    private config: ConfigService,
  ) {}

  private setSessionCookie(res: Response, sessionId: string) {
    res.cookie('yamma_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private inferRequestOrigin(req: Request): string {
    const xfProto = req.headers['x-forwarded-proto'];
    const proto =
      typeof xfProto === 'string'
        ? xfProto.split(',')[0]?.trim() || 'http'
        : Array.isArray(xfProto)
          ? xfProto[0] || 'http'
          : req.protocol || 'http';
    const host = req.headers.host || new URL(this.config.apiUrl).host;
    return `${proto}://${host}`;
  }

  private buildPasswordResetToken(userId: string, email: string): string {
    return sign(
      {
        sub: userId,
        email,
        kind: 'password_reset',
      },
      this.config.sessionSecret,
      { expiresIn: '1h' },
    );
  }

  private parsePasswordResetToken(token: string): { userId: string; email: string } {
    try {
      const decoded = verify(token, this.config.sessionSecret) as {
        sub?: unknown;
        email?: unknown;
        kind?: unknown;
      };
      if (decoded.kind !== 'password_reset') {
        throw new BadRequestException('Invalid reset token');
      }
      if (typeof decoded.sub !== 'string' || typeof decoded.email !== 'string') {
        throw new BadRequestException('Invalid reset token payload');
      }
      return { userId: decoded.sub, email: decoded.email };
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  private async sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
    const host = this.config.smtpHost;
    const user = this.config.smtpUser;
    const pass = this.config.smtpPass;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <h2>Reset your Yamma password</h2>
        <p>We received a password reset request for <strong>${email}</strong>.</p>
        <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
        <p style="margin:24px 0;">
          <a href="${resetLink}" style="display:inline-block;background:#ff5500;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
            Reset password
          </a>
        </p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    if (!host || !user || !pass) {
      throw new ServiceUnavailableException(
        'Password reset email service is not configured on the server (missing SMTP settings).',
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port: this.config.smtpPort,
      secure: this.config.smtpPort === 465,
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({
        from: this.config.smtpFrom,
        to: email,
        subject: 'Reset your Yamma password',
        html,
        text: `Reset your password: ${resetLink}`,
      });
    } catch (error) {
      console.error('[auth/forgot-password] SMTP send failed', error);
      throw new ServiceUnavailableException(
        'Could not deliver password reset email. Please try again in a moment.',
      );
    }
  }

  private requireGoogleEnv() {
    const clientId = this.config.googleClientId;
    const clientSecret = this.config.googleClientSecret;
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'YAMMA_OAUTH_API: Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the API (e.g. Render yamma-api), same Web client as Vercel and Google Cloud.',
      );
    }
    return { clientId, clientSecret };
  }

  /**
   * Shared path for Google web OAuth userinfo and native ID-token sign-in.
   */
  private async verifyAndCreateSessionFromGoogleEmail(
    email: string,
    displayName: string | undefined,
  ): Promise<{ sessionId: string; expiresAt: Date }> {
    if (isGuestUserEmail(email)) {
      throw new BadRequestException('This Google account cannot be used here');
    }
    const name = displayName?.trim() ? displayName.trim() : email.split('@')[0];
    const existing = await this.users.findByEmail(email);
    const user =
      existing ??
      (await this.users.createGoogleUser({
        email,
        name,
      }));
    return this.auth.createSession(user.id);
  }

  /** Verify Google ID token (mobile / Expo) via tokeninfo; `aud` must match configured client IDs. */
  private async verifyGoogleIdToken(idToken: string): Promise<{ email: string; name: string }> {
    const audiences = this.config.googleOAuthAudiences;
    if (!audiences.length) {
      throw new BadRequestException('Google mobile sign-in is not configured on the server.');
    }
    let tokenInfoRes: globalThis.Response;
    try {
      tokenInfoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
    } catch {
      throw new BadRequestException('Could not reach Google to verify sign-in');
    }
    if (!tokenInfoRes.ok) {
      throw new UnauthorizedException('Invalid or expired Google token');
    }
    const p = (await tokenInfoRes.json()) as Record<string, string | undefined>;
    const aud = p.aud;
    if (!aud || !audiences.includes(aud)) {
      throw new UnauthorizedException('Google token is not issued for this app (check client IDs on API and app).');
    }
    const expSec = p.exp ? parseInt(p.exp, 10) : 0;
    if (expSec && expSec * 1000 < Date.now()) {
      throw new UnauthorizedException('Google token expired');
    }
    const email = p.email;
    if (!email) {
      throw new BadRequestException('Google email required');
    }
    const verified = p.email_verified === 'true' || p.email_verified === undefined;
    if (!verified) {
      throw new BadRequestException('Google email not verified');
    }
    const name = p.name?.trim() ? p.name.trim() : email.split('@')[0];
    return { email, name };
  }

  /** Code exchange + user/session creation (redirectUri must match the authorize request). */
  private async completeGoogleOAuth(
    code: string,
    redirectUri: string,
  ): Promise<{ sessionId: string; expiresAt: Date }> {
    const { clientId, clientSecret } = this.requireGoogleEnv();
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text().catch(() => '');
      let detail = errText.slice(0, 400);
      try {
        const j = JSON.parse(errText) as { error?: string; error_description?: string };
        if (j.error_description) detail = j.error_description;
        else if (j.error) detail = j.error;
      } catch {
        /* keep raw text */
      }
      console.error('[google/oauth] token exchange HTTP', tokenResponse.status, detail);
      throw new BadRequestException(`Google token exchange failed: ${detail}`);
    }
    const tokenJson = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new BadRequestException('Google token missing');
    }

    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!userInfoResponse.ok) {
      throw new BadRequestException('Google userinfo failed');
    }
    const userInfo = (await userInfoResponse.json()) as {
      email?: string;
      email_verified?: boolean | string;
      name?: string;
    };
    if (!userInfo.email) {
      throw new BadRequestException('Google email required');
    }
    const verified =
      userInfo.email_verified === true ||
      userInfo.email_verified === 'true' ||
      userInfo.email_verified === undefined;
    if (!verified) {
      throw new BadRequestException('Google email not verified');
    }

    return this.verifyAndCreateSessionFromGoogleEmail(userInfo.email, userInfo.name);
  }

  @Post('google/id-token')
  @HttpCode(HttpStatus.OK)
  async googleIdToken(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const data = googleIdTokenSchema.parse(body);
    if (!this.config.googleOAuthAudiences.length) {
      throw new BadRequestException(
        'Google mobile sign-in is not configured. Set GOOGLE_CLIENT_ID plus GOOGLE_ANDROID_CLIENT_ID / GOOGLE_IOS_CLIENT_ID (and GOOGLE_EXPO_CLIENT_ID for Expo Go) to match your Google Cloud OAuth clients.',
      );
    }
    const { email, name } = await this.verifyGoogleIdToken(data.idToken);
    const { sessionId, expiresAt } = await this.verifyAndCreateSessionFromGoogleEmail(email, name);
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found after Google sign-in');
    }
    this.setSessionCookie(res, sessionId);
    return {
      sessionId,
      user: { id: user.id, email: user.email ?? undefined, name: user.name, role: user.role },
      expiresAt,
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: unknown, @Req() req: Request) {
    const data = forgotPasswordSchema.parse(body);
    const email = data.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    // Avoid account enumeration: always return success shape.
    if (!user || isGuestUserEmail(user.email)) {
      return {
        ok: true,
        message:
          'If an account exists for this email, we sent a reset link. Check your inbox and spam folder.',
      };
    }

    const token = this.buildPasswordResetToken(user.id, email);
    const resetLink = `${this.inferRequestOrigin(req).replace(/\/$/, '')}/auth/reset-password?token=${encodeURIComponent(token)}`;
    await this.sendPasswordResetEmail(email, resetLink);

    return {
      ok: true,
      message:
        'If an account exists for this email, we sent a reset link. Check your inbox and spam folder.',
    };
  }

  @Get('reset-password')
  @HttpCode(HttpStatus.OK)
  renderResetPasswordPage(@Req() req: Request, @Res() res: Response) {
    const tokenRaw = req.query.token;
    const token = typeof tokenRaw === 'string' ? tokenRaw : '';
    const tokenJs = JSON.stringify(token);

    return res.type('html').send(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Reset password - Yamma</title>
    <style>
      body { font-family: Arial, sans-serif; background:#0f1014; color:#fff; margin:0; padding:24px; }
      .card { max-width:420px; margin:40px auto; background:#1c1d23; border:1px solid #2c2d35; border-radius:14px; padding:20px; }
      h1 { margin:0 0 16px; font-size:22px; }
      label { display:block; margin:12px 0 6px; color:#c9cbd5; font-size:14px; }
      input { width:100%; box-sizing:border-box; padding:12px; border-radius:10px; border:1px solid #3d3f4a; background:#121318; color:#fff; }
      button { width:100%; margin-top:16px; padding:12px; border:none; border-radius:10px; background:#ff5500; color:#fff; font-weight:700; cursor:pointer; }
      .msg { margin-top:12px; font-size:14px; }
      .ok { color:#22c55e; }
      .err { color:#ef4444; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Reset your password</h1>
      <label for="password">New password</label>
      <input id="password" type="password" minlength="8" autocomplete="new-password" />
      <label for="confirm">Confirm password</label>
      <input id="confirm" type="password" minlength="8" autocomplete="new-password" />
      <button id="submit">Update password</button>
      <div id="msg" class="msg"></div>
    </div>
    <script>
      const token = ${tokenJs};
      const submit = document.getElementById('submit');
      const msg = document.getElementById('msg');
      submit.addEventListener('click', async () => {
        msg.textContent = '';
        msg.className = 'msg';
        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirm').value;
        if (!token) {
          msg.textContent = 'Invalid reset link. Request a new one.';
          msg.classList.add('err');
          return;
        }
        if (!password || password.length < 8) {
          msg.textContent = 'Password must have at least 8 characters.';
          msg.classList.add('err');
          return;
        }
        if (password !== confirm) {
          msg.textContent = 'Passwords do not match.';
          msg.classList.add('err');
          return;
        }
        submit.disabled = true;
        submit.textContent = 'Updating...';
        try {
          const res = await fetch('/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            msg.textContent = data?.message || 'Could not reset password.';
            msg.classList.add('err');
            return;
          }
          msg.textContent = 'Password updated. You can return to the app and log in.';
          msg.classList.add('ok');
        } catch {
          msg.textContent = 'Network error while resetting password.';
          msg.classList.add('err');
        } finally {
          submit.disabled = false;
          submit.textContent = 'Update password';
        }
      });
    </script>
  </body>
</html>
    `);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: unknown) {
    const data = resetPasswordSchema.parse(body);
    const parsed = this.parsePasswordResetToken(data.token);
    const user = await this.users.findById(parsed.userId);
    if (!user || !user.email || user.email.toLowerCase() !== parsed.email.toLowerCase()) {
      throw new BadRequestException('Invalid reset token');
    }
    if (isGuestUserEmail(user.email)) {
      throw new BadRequestException('Guest accounts cannot reset password');
    }
    await this.users.updatePasswordByUserId(user.id, data.password);
    return { ok: true };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = loginSchema.parse(body);
    const user = await this.users.validatePassword(
      data.email ?? data.phone!,
      data.password,
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const { sessionId, expiresAt } = await this.auth.createSession(user.id);
    this.setSessionCookie(res, sessionId);
    return {
      sessionId,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      expiresAt,
    };
  }

  @Post('register')
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = registerSchema.parse(body);
    if (data.email && isGuestUserEmail(data.email)) {
      throw new BadRequestException('This email is reserved. Use Enter as guest on the home page.');
    }
    const user = await this.users.create({
      email: data.email,
      phone: data.phone,
      name: data.name,
      password: data.password,
      role: data.accountType === 'seller' ? 'restaurant' : 'customer',
    });
    const { sessionId, expiresAt } = await this.auth.createSession(user.id);
    this.setSessionCookie(res, sessionId);
    return {
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      expiresAt,
    };
  }

  @Post('guest-session')
  @HttpCode(HttpStatus.OK)
  async guestSession(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const data = guestSessionSchema.parse(body);
    const role = data.role ?? 'buyer';
    const user = await this.users.ensureGuestUser(role);
    if (role === 'seller') {
      await this.restaurants.seedGuestSellerDemoIfNeeded(user.id);
    }
    const { sessionId, expiresAt } = await this.auth.createSession(user.id);
    this.setSessionCookie(res, sessionId);
    return {
      sessionId,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      expiresAt,
    };
  }

  /**
   * Called by the Next.js OAuth callback (server-to-server) so the session cookie can be set on the web origin.
   */
  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  async googleExchange(@Body() body: unknown) {
    const parsed = googleExchangeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        `Invalid request: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      );
    }
    const data = parsed.data;
    let redirectOk = false;
    try {
      const u = new URL(data.redirectUri);
      const pathOk = u.pathname === '/api/auth/google/callback';
      if (this.config.env === 'development') {
        const schemeOk = u.protocol === 'http:' || u.protocol === 'https:';
        redirectOk = pathOk && schemeOk;
      } else {
        redirectOk = pathOk && u.protocol === 'https:';
      }
    } catch {
      redirectOk = false;
    }
    if (!redirectOk) {
      throw new BadRequestException('Invalid redirect URI');
    }
    try {
      const { sessionId, expiresAt } = await this.completeGoogleOAuth(data.code, data.redirectUri);
      return { sessionId, expiresAt: expiresAt.toISOString() };
    } catch (e: unknown) {
      if (e instanceof HttpException || isNestHttpExceptionShape(e)) {
        throw e;
      }
      const msg = formatUnknownError(e);
      console.error('[auth/google/exchange] unexpected', msg, e);
      throw new BadRequestException(
        this.config.env === 'development'
          ? `Google sign-in server error: ${msg.slice(0, 400)}`
          : 'Google sign-in server error',
      );
    }
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: { sessionId?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.sessionId) await this.auth.invalidateSession(req.sessionId);
    res.clearCookie('yamma_session', { path: '/' });
    return { ok: true };
  }

  @Post('delete-account')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@CurrentUser() user: SessionUser, @Res({ passthrough: true }) res: Response) {
    await this.users.deleteMyAccount(user.id);
    res.clearCookie('yamma_session', { path: '/' });
    return { ok: true };
  }

  @Post('me')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: SessionUser) {
    /** Avoid an extra DB round-trip on every page load — balance only matters for sellers */
    if (user.role !== 'restaurant') {
      return { user };
    }
    const row = await this.users.findById(user.id);
    if (!row) return { user };
    return {
      user: {
        ...user,
        fiatBalance: row.fiatBalance ?? '0.00',
      },
    };
  }
}
