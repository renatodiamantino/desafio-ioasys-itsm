import { Module } from '@nestjs/common';
import { ScimController } from './scim.controller';
import { UsersImportController } from './users-import.controller';
import { UsersImportService } from './users-import.service';

@Module({
  controllers: [UsersImportController, ScimController],
  providers: [UsersImportService],
  exports: [UsersImportService],
})
export class UsersModule {}
