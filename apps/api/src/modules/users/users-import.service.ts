import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ScimUserInput } from '@itsm/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface CsvImportError {
  line: number;
  email: string;
  error: string;
}

export interface CsvImportReport {
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: CsvImportError[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value: string): boolean {
  return value.length <= 255 && EMAIL_REGEX.test(value);
}

@Injectable()
export class UsersImportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Importa (ou simula via dryRun) usuários e grupos a partir de CSV (US-004). */
  async importCsv(
    csvContent: string,
    dryRun: boolean,
    actorId: string,
  ): Promise<CsvImportReport> {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException(
        'CSV deve conter cabeçalho e ao menos uma linha de dados.',
      );
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = this.parseCsvLine(lines[0], delimiter).map((h) =>
      h.toLowerCase().trim(),
    );

    const emailIdx = headers.indexOf('email');
    const nameIdx = headers.indexOf('name');
    if (emailIdx === -1 || nameIdx === -1) {
      throw new BadRequestException(
        'Cabeçalho CSV obrigatório deve conter as colunas "email" e "name".',
      );
    }

    const jobTitleIdx = headers.indexOf('jobtitle');
    const phoneIdx = headers.indexOf('phone');
    const groupsIdx = headers.indexOf('groups');

    const seenEmails = new Set<string>();
    const validRows: Array<{
      email: string;
      name: string;
      jobTitle?: string;
      phone?: string;
      groups: string[];
    }> = [];
    const errors: CsvImportError[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i], delimiter);
      const rawEmail = (cols[emailIdx] ?? '').trim().toLowerCase();
      const rawName = (cols[nameIdx] ?? '').trim();

      if (!isValidEmail(rawEmail)) {
        errors.push({ line: i + 1, email: rawEmail, error: 'E-mail inválido' });
        continue;
      }
      if (!rawName) {
        errors.push({ line: i + 1, email: rawEmail, error: 'Nome obrigatório' });
        continue;
      }
      if (seenEmails.has(rawEmail)) {
        errors.push({
          line: i + 1,
          email: rawEmail,
          error: 'E-mail duplicado no arquivo CSV',
        });
        continue;
      }
      seenEmails.add(rawEmail);

      const rawGroups = groupsIdx >= 0 ? (cols[groupsIdx] ?? '') : '';
      const groups = rawGroups
        .split('|')
        .map((g) => g.trim())
        .filter(Boolean);

      validRows.push({
        email: rawEmail,
        name: rawName,
        jobTitle: jobTitleIdx >= 0 ? cols[jobTitleIdx]?.trim() || undefined : undefined,
        phone: phoneIdx >= 0 ? cols[phoneIdx]?.trim() || undefined : undefined,
        groups,
      });
    }

    const existingUsers = await this.prisma.user.findMany({
      where: { email: { in: validRows.map((r) => r.email) } },
      select: { id: true, email: true },
    });
    const existingByEmail = new Map(existingUsers.map((u) => [u.email, u.id]));

    let created = 0;
    let updated = 0;

    if (dryRun) {
      for (const row of validRows) {
        if (existingByEmail.has(row.email)) updated++;
        else created++;
      }
      return {
        dryRun: true,
        totalRows: lines.length - 1,
        created,
        updated,
        skipped: errors.length,
        errors,
      };
    }

    const endUserRole = await this.prisma.role.findUnique({
      where: { code: 'end_user' },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const row of validRows) {
        const existingId = existingByEmail.get(row.email);
        let userId: string;

        if (existingId) {
          await tx.user.update({
            where: { id: existingId },
            data: {
              name: row.name,
              jobTitle: row.jobTitle,
              phone: row.phone,
            },
          });
          userId = existingId;
          updated++;
        } else {
          const newUser = await tx.user.create({
            data: {
              email: row.email,
              name: row.name,
              jobTitle: row.jobTitle,
              phone: row.phone,
              isActive: true,
            },
          });
          userId = newUser.id;
          if (endUserRole) {
            await tx.userRole.create({
              data: { userId, roleId: endUserRole.id },
            });
          }
          created++;
        }

        for (const groupName of row.groups) {
          const group = await tx.group.upsert({
            where: { name: groupName },
            update: {},
            create: { name: groupName },
          });
          await tx.groupMember.upsert({
            where: { groupId_userId: { groupId: group.id, userId } },
            update: {},
            create: { groupId: group.id, userId },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          entityType: 'user',
          entityId: actorId,
          action: 'IMPORT_CSV',
          actorId,
          newValue: { totalRows: lines.length - 1, created, updated, errors: errors.length },
        },
      });
    });

    return {
      dryRun: false,
      totalRows: lines.length - 1,
      created,
      updated,
      skipped: errors.length,
      errors,
    };
  }

  /** Lista usuários no formato SCIM 2.0. */
  async scimListUsers(filter?: string) {
    let emailFilter: string | undefined;
    if (filter) {
      const match = /userName\s+eq\s+"([^"]+)"/i.exec(filter);
      if (match) emailFilter = match[1].toLowerCase();
    }

    const users = await this.prisma.user.findMany({
      where: emailFilter ? { email: emailFilter } : undefined,
      orderBy: { createdAt: 'asc' },
    });

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: users.length,
      Resources: users.map((u) => this.toScimResource(u)),
    };
  }

  /** Cria usuário via SCIM 2.0 (/scim/v2/Users). */
  async scimCreateUser(input: ScimUserInput) {
    const email = this.extractScimEmail(input);
    const name = this.extractScimName(input, email);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return this.scimUpdateUser(existing.id, input);
    }

    const endUserRole = await this.prisma.role.findUnique({
      where: { code: 'end_user' },
    });

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name,
          externalId: input.externalId ?? null,
          isActive: input.active ?? true,
        },
      });
      if (endUserRole) {
        await tx.userRole.create({
          data: { userId: created.id, roleId: endUserRole.id },
        });
      }
      await tx.auditLog.create({
        data: {
          entityType: 'user',
          entityId: created.id,
          action: 'SCIM_CREATE',
          newValue: { email, name, externalId: input.externalId ?? null },
        },
      });
      return created;
    });

    return this.toScimResource(user);
  }

  /** Atualiza usuário via SCIM 2.0 (/scim/v2/Users/:id). */
  async scimUpdateUser(id: string, input: ScimUserInput) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Usuário SCIM não encontrado.');

    const nextEmail = input.userName || input.emails?.[0]?.value
      ? this.extractScimEmail(input)
      : existing.email;
    const nextName =
      input.displayName || input.name?.formatted || input.name?.givenName
        ? this.extractScimName(input, nextEmail)
        : existing.name;

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.user.update({
        where: { id },
        data: {
          email: nextEmail,
          name: nextName,
          externalId: input.externalId ?? existing.externalId,
          isActive: input.active ?? existing.isActive,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'user',
          entityId: id,
          action: 'SCIM_UPDATE',
          oldValue: { email: existing.email, name: existing.name, isActive: existing.isActive },
          newValue: { email: res.email, name: res.name, isActive: res.isActive },
        },
      });
      return res;
    });

    return this.toScimResource(updated);
  }

  /** Desativa usuário via SCIM 2.0 (DELETE /scim/v2/Users/:id). */
  async scimDeactivateUser(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Usuário SCIM não encontrado.');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { isActive: false },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'user',
          entityId: id,
          action: 'SCIM_DEACTIVATE',
          fieldName: 'isActive',
          oldValue: existing.isActive,
          newValue: false,
        },
      });
    });
  }

  private extractScimEmail(input: ScimUserInput): string {
    const raw =
      input.userName ??
      input.emails?.find((e) => e.primary)?.value ??
      input.emails?.[0]?.value;
    if (!raw || !isValidEmail(raw)) {
      throw new BadRequestException('SCIM userName ou emails[0].value inválido.');
    }
    return raw.toLowerCase();
  }

  private extractScimName(input: ScimUserInput, fallback: string): string {
    if (input.displayName?.trim()) return input.displayName.trim();
    if (input.name?.formatted?.trim()) return input.name.formatted.trim();
    const parts = [input.name?.givenName, input.name?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return parts || fallback;
  }

  private toScimResource(user: {
    id: string;
    email: string;
    name: string;
    externalId: string | null;
    isActive: boolean;
  }) {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      externalId: user.externalId ?? undefined,
      userName: user.email,
      displayName: user.name,
      active: user.isActive,
      emails: [{ value: user.email, primary: true }],
    };
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }
}
