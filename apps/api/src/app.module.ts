import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { AuditModule } from './modules/audit/audit.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationModule, IncidentsModule, AuditModule, UsersModule],
})
export class AppModule {}
