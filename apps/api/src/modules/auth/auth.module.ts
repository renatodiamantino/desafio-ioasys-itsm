import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, SsoController],
  providers: [AuthService, SsoService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, SsoService, JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
