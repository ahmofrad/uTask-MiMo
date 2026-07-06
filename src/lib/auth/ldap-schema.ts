import { z } from "zod";

export const ldapConfigSchema = z.object({
  enabled: z.boolean(),
  url: z.string().url(),
  bindDn: z.string(),
  bindPassword: z.string(),
  searchBase: z.string(),
  searchFilter: z.string(),
  usernameAttribute: z.string().default("uid"),
  emailAttribute: z.string().default("mail"),
  nameAttribute: z.string().default("cn"),
  groupSearchBase: z.string().optional(),
  groupSearchFilter: z.string().optional(),
  defaultRole: z.string().default("member"),
  adminGroupDn: z.string().optional(),
  syncIntervalMinutes: z.number().default(60),
  tlsCaCert: z.string().optional(),
});

export type LdapConfig = z.infer<typeof ldapConfigSchema>;
