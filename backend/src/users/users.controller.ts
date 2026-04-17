import { Controller, Get, Param, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { z } from 'zod';

const roleQuerySchema = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((item) => item.trim()) : []))
  .pipe(z.array(z.enum(['customer', 'restaurant', 'admin', 'driver'])));

const updateRoleSchema = z.object({
  role: z.enum(['customer', 'restaurant', 'admin', 'driver']),
});

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('admin')
  async list(@Query('roles') rolesRaw?: string) {
    const roles = roleQuerySchema.parse(rolesRaw);
    const rows = await this.users.listByRoles(roles);
    return rows.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    }));
  }

  @Get(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('admin')
  async getById(@Param('id') id: string) {
    const user = await this.users.findById(id);
    if (!user) return { error: 'Not found' };
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  @Patch(':id/role')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('admin')
  async updateRole(@Param('id') id: string, @Body() body: unknown) {
    const data = updateRoleSchema.parse(body);
    const user = await this.users.updateRole(id, data.role);
    if (!user) return { error: 'Not found' };
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
