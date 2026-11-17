import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { csvImportUsersSchema } from '@itsm/shared';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersImportService } from './users-import.service';

@ApiTags('Users Import (US-004)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('users/import')
export class UsersImportController {
  constructor(private readonly usersImportService: UsersImportService) {}

  @Post('csv')
  @ApiOperation({ summary: 'Importa usuários e grupos via CSV (com suporte a dryRun)' })
  async importCsv(
    @Body() body: unknown,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const parsed = csvImportUsersSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.usersImportService.importCsv(
      parsed.data.csvContent,
      parsed.data.dryRun,
      actor.id,
    );
  }
}
