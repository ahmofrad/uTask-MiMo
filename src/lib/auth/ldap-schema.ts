import { z } from "zod";

export const ldapConfigSchema = z.object({
  enabled: z.boolean(),
  url: z.string().url(),
  // Admin/service account UPN used to bind and search the directory.
  bindUpn: z.string(),
  bindPassword: z.string(),
  // Optional UPN suffix (e.g. "@corp.local") appended when a user logs in with
  // only a samaccountname. End users may also log in with their full UPN.
  upnSuffix: z.string().optional(),
  emailAttribute: z.string().default("mail"),
  nameAttribute: z.string().default("cn"),
  defaultRole: z.string().default("member"),
  // Hours between automatic group syncs.
  syncIntervalHours: z.number().int().min(1).max(744).default(12),
  tlsCaCert: z.string().optional(),
});

export type LdapConfig = z.infer<typeof ldapConfigSchema>;
