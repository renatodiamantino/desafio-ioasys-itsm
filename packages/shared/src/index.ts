import { z } from 'zod';

export const SUPPORTED_LOCALES = ['pt-BR', 'en', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const TASK_TYPES = ['INCIDENT', 'REQUEST', 'REQUEST_ITEM', 'CATALOG_TASK'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const INCIDENT_STATES = [
  'NEW',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
] as const;
export type IncidentState = (typeof INCIDENT_STATES)[number];

export const SYSTEM_ROLE_CODES = ['end_user', 'agent', 'manager', 'admin'] as const;
export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

export const organizationSetupSchema = z.object({
  companyName: z.string().min(2).max(150),
  supportEmail: z.string().email().max(255),
  defaultTimezone: z.string().min(2).max(64).default('America/Sao_Paulo'),
  defaultLocale: z.enum(SUPPORTED_LOCALES).default('pt-BR'),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato hexadecimal #RRGGBB')
    .default('#0F4C81'),
  logoUrl: z.string().url().optional().or(z.literal('')),
  adminName: z.string().min(2).max(150),
  adminEmail: z.string().email().max(255),
  adminPassword: z.string().min(8).max(128),
});

export type OrganizationSetupInput = z.infer<typeof organizationSetupSchema>;

export const organizationUpdateSchema = organizationSetupSchema
  .omit({ adminName: true, adminEmail: true, adminPassword: true })
  .partial()
  .extend({
    autoCloseDays: z.number().int().min(1).max(90).optional(),
    reopenWindowDays: z.number().int().min(0).max(90).optional(),
  });

export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const mfaVerifySchema = z.object({
  mfaToken: z.string().min(10),
  code: z.string().regex(/^\d{6}$/, 'Código MFA deve ter 6 dígitos'),
});
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const assignUserRolesSchema = z.object({
  roleCodes: z.array(z.string().min(1)).min(1),
});
export type AssignUserRolesInput = z.infer<typeof assignUserRolesSchema>;

// US-021: Matriz Impacto x Urgência (1=Alto, 2=Médio, 3=Baixo -> P1..P5)
const PRIORITY_MATRIX: Record<number, Record<number, number>> = {
  1: { 1: 1, 2: 2, 3: 3 },
  2: { 1: 2, 2: 3, 3: 4 },
  3: { 1: 3, 2: 4, 3: 5 },
};

export function calculatePriority(impact: number, urgency: number): number {
  return PRIORITY_MATRIX[impact]?.[urgency] ?? 4;
}

export const INCIDENT_CHANNELS = ['PORTAL', 'EMAIL', 'PHONE', 'WALK_IN', 'API'] as const;
export type IncidentChannel = (typeof INCIDENT_CHANNELS)[number];

export const createIncidentSchema = z.object({
  shortDescription: z.string().min(3).max(255),
  description: z.string().max(10000).optional(),
  requesterId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  impact: z.number().int().min(1).max(3).default(3),
  urgency: z.number().int().min(1).max(3).default(3),
  channel: z.enum(INCIDENT_CHANNELS).default('PORTAL'),
  assignedGroupId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export const updateIncidentSchema = z.object({
  shortDescription: z.string().min(3).max(255).optional(),
  description: z.string().max(10000).optional(),
  state: z.enum(INCIDENT_STATES).optional(),
  holdReasonId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  impact: z.number().int().min(1).max(3).optional(),
  urgency: z.number().int().min(1).max(3).optional(),
  priorityOverride: z.number().int().min(1).max(5).optional(),
  priorityOverrideReason: z.string().min(3).max(500).optional(),
  assignedGroupId: z.string().uuid().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  reassignmentReason: z.string().max(500).optional(),
});
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

export const addTaskCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  isInternal: z.boolean().default(false),
});
export type AddTaskCommentInput = z.infer<typeof addTaskCommentSchema>;

export const resolveIncidentSchema = z.object({
  resolutionCodeId: z.string().uuid(),
  resolutionNotes: z.string().min(3).max(5000),
});
export type ResolveIncidentInput = z.infer<typeof resolveIncidentSchema>;

export const linkChildIncidentsSchema = z.object({
  childIds: z.array(z.string().uuid()).min(1),
});
export type LinkChildIncidentsInput = z.infer<typeof linkChildIncidentsSchema>;

export const auditLogsQuerySchema = z.object({
  entityType: z.string().min(1).max(60).optional(),
  entityId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().min(1).max(30).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AuditLogsQueryInput = z.infer<typeof auditLogsQuerySchema>;

export const updateLocaleSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
});
export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;

export const csvImportUsersSchema = z.object({
  csvContent: z.string().min(1).max(2_000_000),
  dryRun: z.boolean().default(false),
});
export type CsvImportUsersInput = z.infer<typeof csvImportUsersSchema>;

export const scimUserSchema = z.object({
  userName: z.string().email().optional(),
  externalId: z.string().max(255).optional(),
  displayName: z.string().min(1).max(150).optional(),
  name: z
    .object({
      formatted: z.string().optional(),
      givenName: z.string().optional(),
      familyName: z.string().optional(),
    })
    .optional(),
  emails: z
    .array(
      z.object({
        value: z.string().email(),
        primary: z.boolean().optional(),
      }),
    )
    .optional(),
  active: z.boolean().optional(),
});
export type ScimUserInput = z.infer<typeof scimUserSchema>;

export const ssoConfigSchema = z.object({
  enabled: z.boolean().default(false),
  protocol: z.enum(['OIDC', 'SAML']).default('OIDC'),
  providerName: z.string().min(2).max(100).default('SSO Corporativo'),
  issuerUrl: z.string().url().optional().or(z.literal('')),
  clientId: z.string().max(255).optional(),
  clientSecret: z.string().max(500).optional(),
  metadataXml: z.string().max(50000).optional(),
  jitProvisioning: z.boolean().default(true),
});
export type SsoConfigInput = z.infer<typeof ssoConfigSchema>;

export const ssoCallbackSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(150).optional(),
  externalId: z.string().max(255).optional(),
  assertionToken: z.string().min(1).optional(),
});
export type SsoCallbackInput = z.infer<typeof ssoCallbackSchema>;

export * from './i18n';

