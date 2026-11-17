import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SsoCallbackInput, SsoConfigInput } from '@itsm/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

@Injectable()
export class SsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  private parseConfig(raw: unknown): SsoConfigInput {
    const cfg = (raw && typeof raw === 'object' ? raw : {}) as Partial<SsoConfigInput>;
    return {
      enabled: Boolean(cfg.enabled),
      protocol: cfg.protocol === 'SAML' ? 'SAML' : 'OIDC',
      providerName: cfg.providerName || 'SSO Corporativo',
      issuerUrl: cfg.issuerUrl || '',
      clientId: cfg.clientId || '',
      clientSecret: cfg.clientSecret || '',
      metadataXml: cfg.metadataXml || '',
      jitProvisioning: cfg.jitProvisioning ?? true,
    };
  }

  /** Retorna metadados públicos de SSO para a tela de /login (sem expor clientSecret). */
  async getPublicConfig() {
    const org = await this.prisma.organizationSettings.findFirst();
    const cfg = this.parseConfig(org?.ssoConfig);
    return {
      enabled: cfg.enabled,
      protocol: cfg.protocol,
      providerName: cfg.providerName,
      issuerUrl: cfg.issuerUrl || null,
    };
  }

  /** Retorna configuração administrativa do IdP com secret mascarado. */
  async getAdminConfig() {
    const org = await this.prisma.organizationSettings.findFirst();
    if (!org) throw new NotFoundException('Organização ainda não configurada.');

    const cfg = this.parseConfig(org.ssoConfig);
    return {
      enabled: cfg.enabled,
      protocol: cfg.protocol,
      providerName: cfg.providerName,
      issuerUrl: cfg.issuerUrl,
      clientId: cfg.clientId,
      hasClientSecret: Boolean(cfg.clientSecret),
      metadataXml: cfg.metadataXml,
      jitProvisioning: cfg.jitProvisioning,
    };
  }

  /** Salva configuração do IdP (OIDC / SAML) em organization_settings.sso_config e audita. */
  async saveConfig(input: SsoConfigInput, actorId: string) {
    const org = await this.prisma.organizationSettings.findFirst();
    if (!org) throw new NotFoundException('Organização ainda não configurada.');

    const previous = this.parseConfig(org.ssoConfig);
    const nextConfig: SsoConfigInput = {
      ...input,
      clientSecret: input.clientSecret?.trim()
        ? input.clientSecret.trim()
        : previous.clientSecret,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationSettings.update({
        where: { id: org.id },
        data: { ssoConfig: nextConfig as unknown as Prisma.InputJsonValue },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'organization_settings',
          entityId: org.id,
          action: 'SSO_CONFIG_UPDATE',
          actorId,
          fieldName: 'ssoConfig',
          oldValue: { enabled: previous.enabled, protocol: previous.protocol },
          newValue: {
            enabled: nextConfig.enabled,
            protocol: nextConfig.protocol,
            providerName: nextConfig.providerName,
            jitProvisioning: nextConfig.jitProvisioning,
          },
        },
      });
    });

    return this.getAdminConfig();
  }

  /** Gera URL de redirecionamento para o IdP (OIDC / SAML). */
  async getLoginRedirectUrl(redirectUri: string) {
    const org = await this.prisma.organizationSettings.findFirst();
    const cfg = this.parseConfig(org?.ssoConfig);
    if (!cfg.enabled) {
      throw new ForbiddenException('SSO corporativo não está habilitado.');
    }

    const base = (cfg.issuerUrl || 'https://idp.example.com').replace(/\/$/, '');
    const url =
      cfg.protocol === 'OIDC'
        ? `${base}/authorize?client_id=${encodeURIComponent(cfg.clientId || '')}&response_type=code&scope=openid%20profile%20email&redirect_uri=${encodeURIComponent(redirectUri)}`
        : `${base}/sso/saml?acs=${encodeURIComponent(redirectUri)}`;

    return { protocol: cfg.protocol, providerName: cfg.providerName, authorizeUrl: url };
  }

  /** Conclui login via callback IdP, com suporte a Just-In-Time provisioning (US-003). */
  async authenticateViaSso(input: SsoCallbackInput) {
    const org = await this.prisma.organizationSettings.findFirst();
    const cfg = this.parseConfig(org?.ssoConfig);
    if (!cfg.enabled) {
      throw new ForbiddenException('SSO corporativo não está habilitado.');
    }

    const email = input.email.trim().toLowerCase();
    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      if (!cfg.jitProvisioning) {
        throw new UnauthorizedException(
          'Usuário não encontrado e provisionamento JIT desabilitado.',
        );
      }

      const endUserRole = await this.prisma.role.findUnique({
        where: { code: 'end_user' },
      });

      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            name: input.name?.trim() || email.split('@')[0],
            externalId: input.externalId ?? null,
            isActive: true,
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
            action: 'SSO_JIT_CREATE',
            newValue: { email, protocol: cfg.protocol },
          },
        });
        return tx.user.findUniqueOrThrow({
          where: { id: created.id },
          include: { roles: { include: { role: true } } },
        });
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuário desativado.');
    }

    await this.prisma.auditLog.create({
      data: {
        entityType: 'user',
        entityId: user.id,
        action: 'LOGIN_SSO',
        actorId: user.id,
        newValue: { protocol: cfg.protocol },
      },
    });

    return this.authService.issueTokens(user);
  }
}
