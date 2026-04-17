import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionUser } from '../auth.types';

export const CurrentUser = createParamDecorator(
  (data: keyof SessionUser | undefined, ctx: ExecutionContext): SessionUser | unknown => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as SessionUser;
    return data ? user?.[data] : user;
  },
);
