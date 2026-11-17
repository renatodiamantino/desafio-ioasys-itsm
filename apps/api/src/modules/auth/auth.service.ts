import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginInput, MfaVerifyInput } from '@itsm/shared';
import * as argon2 from 'argon2';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from './auth.types';

interface FailedAttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly failedAttempts = new Map<string, FailedAttemptRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private getJwtSecret(): string {
    return process.env.JWT_SECRET || 'dev-secret-change-in-prod';
  }

  private assertNotLocked(email: string): void {
    const rec = this.failedAttempts.get(email);
    if (!rec) return;

    const now = Date.now();
    if (rec.lockedUntil && now < rec.lockedUntil) {
      throw new HttpException(
        'Conta temporariamente bloqueada devido a múltiplas tentativas inválidas. Tente novamente em 15 minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (now - rec.firstAttemptAt > ATTEMPT_WINDOW_MS) {
      this.failedAttempts.delete(email);
    }
  }

  private recordFailedAttempt(email: string): void {
    const now = Date.now();
    const rec = this.failedAttempts.get(email);
    if (!rec || now - rec.firstAttemptAt > ATTEMPT_WINDOW_MS) {
      this.failedAttempts.set(email, { count: 1, firstAttemptAt: now });
      return;
    }

    rec.count += 1;
    if (rec.count >= MAX_FAILED_ATTEMPTS) {
      rec.lockedUntil = now + LOCKOUT_MS;
    }
    this.failedAttempts.set(email, rec);
  }

  private clearFailedAttempts(email: string): void {
    this.failedAttempts.delete(email);
  }

  async issueTokens(user: {
    id: string;
    email: string;
    name: string;
    locale: string;
    roles: { role: { code: string } }[];
  }) {
    const roleCodes = user.roles.map((r) => r.role.code);
    const secret = this.getJwtSecret();

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, roles: roleCodes, type: 'access' } satisfies JwtPayload,
      { secret, expiresIn: '15m' },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, roles: roleCodes, type: 'refresh' } satisfies JwtPayload,
      { secret, expiresIn: '7d' },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        roles: roleCodes,
      },
    };
  }

  async login(input: LoginInput) {
    const email = input.email.toLowerCase();
    this.assertNotLocked(email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.isActive || !user.passwordHash) {
      this.recordFailedAttempt(email);
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      this.recordFailedAttempt(email);
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    this.clearFailedAttempts(email);

    if (user.mfaEnabled && user.mfaSecretEnc) {
      const mfaToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          roles: user.roles.map((r) => r.role.code),
          type: 'mfa_pending',
        } satisfies JwtPayload,
        { secret: this.getJwtSecret(), expiresIn: '5m' },
      );

      return { mfaRequired: true, mfaToken };
    }

    await this.prisma.auditLog.create({
      data: {
        entityType: 'user',
        entityId: user.id,
        action: 'LOGIN',
        actorId: user.id,
      },
    });

    return {
      mfaRequired: false,
      ...(await this.issueTokens(user)),
    };
  }

  async verifyMfa(input: MfaVerifyInput) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(input.mfaToken, {
        secret: this.getJwtSecret(),
      });
    } catch {
      throw new UnauthorizedException('Token MFA inválido ou expirado.');
    }

    if (payload.type !== 'mfa_pending') {
      throw new UnauthorizedException('Tipo de token inválido para MFA.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.isActive || !user.mfaSecretEnc) {
      throw new UnauthorizedException('Usuário inválido.');
    }

    const verification = verifySync({
      token: input.code,
      secret: user.mfaSecretEnc,
    });

    if (!verification.valid) {
      throw new UnauthorizedException('Código MFA inválido.');
    }

    await this.prisma.auditLog.create({
      data: {
        entityType: 'user',
        entityId: user.id,
        action: 'LOGIN_MFA',
        actorId: user.id,
      },
    });

    return this.issueTokens(user);
  }

  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: 'ITSM Platform',
      label: user.email,
      secret,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: secret, mfaEnabled: true },
    });

    return { secret, otpauthUrl };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.getJwtSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Tipo de token inválido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inativo ou não encontrado.');
    }

    return this.issueTokens(user);
  }

  async assignUserRoles(targetUserId: string, roleCodes: string[], actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const roles = await this.prisma.role.findMany({
      where: { code: { in: roleCodes } },
    });
    if (roles.length !== roleCodes.length) {
      throw new ForbiddenException('Um ou mais papéis informados não existem.');
    }

    const oldRoles = user.roles.map((r) => r.role.code);

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: targetUserId } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId: targetUserId, roleId: role.id })),
      });
      await tx.auditLog.create({
        data: {
          entityType: 'user',
          entityId: targetUserId,
          action: 'UPDATE',
          actorId,
          fieldName: 'roles',
          oldValue: oldRoles,
          newValue: roleCodes,
        },
      });
    });

    return { userId: targetUserId, roles: roleCodes };
  }

  /** Atualiza o idioma preferido do usuário autenticado (US-008) e registra em audit_logs. */
  async updateLocale(userId: string, locale: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const oldLocale = user.locale;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { locale },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'user',
          entityId: userId,
          action: 'UPDATE',
          actorId: userId,
          fieldName: 'locale',
          oldValue: oldLocale,
          newValue: locale,
        },
      });
    });

    return { userId, locale };
  }
}
