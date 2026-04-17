import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import type { SessionUser } from '../auth.types';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const sessionId = this.auth.getSessionFromRequest(req);
    if (!sessionId) throw new UnauthorizedException('Not authenticated');
    const result = await this.auth.validateSession(sessionId);
    if (!result) throw new UnauthorizedException('Invalid or expired session');
    req.user = result.user as SessionUser;
    req.sessionId = sessionId;
    return true;
  }
}
