import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { SessionGuard } from '../auth/guards/session.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [UsersService, SessionGuard, RolesGuard],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
