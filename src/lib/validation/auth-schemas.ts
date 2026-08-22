import { z } from "zod";

const uuid = z.string().uuid();

export const userCreateSchema = z.object({
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(["owner", "admin", "manager", "member", "guest"]).optional(),
}).strict();

export const userRoleUpdateSchema = z.object({
  role: z.enum(["owner", "admin", "manager", "member", "guest"]),
}).strict();

export const userUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(255).optional(),
  locale: z.enum(["fa_IR", "en_US"]).optional(),
  accentColor: z.string().trim().min(1).max(64).optional(),
  theme: z.enum(["light", "dark", "system", "midnight", "solarized", "high_contrast", "nord"]).optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const inviteAcceptSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(12).max(128),
}).strict();

export const passwordResetSchema = z.object({
  token: z.string().trim().min(32).max(256),
  password: z.string().min(12).max(128),
  confirmPassword: z.string().min(12).max(128),
}).strict().refine((value) => value.password === value.confirmPassword, {
  message: "passwordMismatch",
  path: ["confirmPassword"],
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(320),
}).strict();

export const publicTokenCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  scopes: z.array(z.string().trim().min(1)).min(1).max(20),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();

const patchUrlSchema = z.union([z.literal(""), z.string().url()]);

export const ldapSourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  enabled: z.boolean().default(false),
  url: z.string().url(),
  bindUpn: z.string().trim().min(1).max(255),
  bindPassword: z.string().min(1).max(512),
  upnSuffix: z.string().trim().max(255).optional(),
  searchBase: z.string().trim().max(512).optional(),
  emailAttribute: z.string().trim().max(64).default("mail"),
  nameAttribute: z.string().trim().max(64).default("cn"),
  defaultRole: z.string().trim().max(64).default("member"),
  syncIntervalHours: z.number().int().min(1).max(744).default(12),
  tlsCaCert: z.string().max(16_384).optional(),
}).strict();

export const ldapSourceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  enabled: z.boolean().optional(),
  url: patchUrlSchema.optional(),
  bindUpn: z.string().trim().min(1).max(255).optional(),
  bindPassword: z.string().max(512).optional(),
  upnSuffix: z.union([z.literal(""), z.string().trim().max(255)]).optional(),
  searchBase: z.union([z.literal(""), z.string().trim().max(512)]).optional(),
  emailAttribute: z.string().trim().max(64).optional(),
  nameAttribute: z.string().trim().max(64).optional(),
  defaultRole: z.string().trim().max(64).optional(),
  syncIntervalHours: z.number().int().min(1).max(744).optional(),
  tlsCaCert: z.union([z.literal(""), z.string().max(16_384)]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const ldapLoginSchema = z.object({
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(512),
  sourceId: uuid.optional(),
}).strict();

export const ldapGroupSchema = z.object({
  dn: z.string().trim().min(1).max(2_048),
  name: z.string().trim().min(1).max(255),
}).strict();

export const ldapSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  url: patchUrlSchema.optional(),
  bindUpn: z.string().optional(),
  bindPassword: z.string().optional(),
  upnSuffix: z.string().optional(),
  emailAttribute: z.string().optional(),
  nameAttribute: z.string().optional(),
  defaultRole: z.string().optional(),
  syncIntervalHours: z.number().int().min(1).max(744).optional(),
  tlsCaCert: z.string().optional(),
}).strict();

export const samlSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  entityId: patchUrlSchema.optional(),
  acsUrl: patchUrlSchema.optional(),
  sloUrl: patchUrlSchema.optional(),
  idpMetadataUrl: patchUrlSchema.optional(),
  idpEntityId: z.string().optional(),
  idpSsoUrl: patchUrlSchema.optional(),
  idpCertificate: z.string().optional(),
  nameIdFormat: z.string().optional(),
  attributeMap: z.object({
    email: z.string().optional(),
    displayName: z.string().optional(),
    role: z.string().optional(),
  }).strict().optional(),
  defaultRole: z.string().optional(),
  adminRoleValue: z.string().optional(),
  wantAssertionsSigned: z.boolean().optional(),
  wantResponseSigned: z.boolean().optional(),
  signatureAlgorithm: z.string().optional(),
  digestAlgorithm: z.string().optional(),
}).strict();

export const ssoSettingsUpdateSchema = z.object({
  ldap: ldapSettingsUpdateSchema.optional(),
  saml: samlSettingsUpdateSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");