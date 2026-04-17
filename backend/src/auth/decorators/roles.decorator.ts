import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../guards/roles.guard';
import type { Role } from '../auth.types';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
