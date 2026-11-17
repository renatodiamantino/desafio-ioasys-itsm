import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { scimUserSchema } from '@itsm/shared';
import { ScimTokenGuard } from './scim-token.guard';
import { UsersImportService } from './users-import.service';

@ApiTags('SCIM 2.0 (US-004)')
@ApiBearerAuth()
@UseGuards(ScimTokenGuard)
@Controller('scim/v2/Users')
export class ScimController {
  constructor(private readonly usersImportService: UsersImportService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuários no padrão SCIM 2.0' })
  async list(@Query('filter') filter?: string) {
    return this.usersImportService.scimListUsers(filter);
  }

  @Post()
  @ApiOperation({ summary: 'Cria ou atualiza usuário via SCIM 2.0' })
  async create(@Body() body: unknown) {
    const parsed = scimUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.usersImportService.scimCreateUser(parsed.data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza usuário via SCIM 2.0 (PUT)' })
  async replace(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const parsed = scimUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.usersImportService.scimUpdateUser(id, parsed.data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza usuário parcialmente via SCIM 2.0 (PATCH)' })
  async patch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const parsed = scimUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.usersImportService.scimUpdateUser(id, parsed.data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desativa usuário via SCIM 2.0 (DELETE)' })
  async deactivate(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.usersImportService.scimDeactivateUser(id);
  }
}
