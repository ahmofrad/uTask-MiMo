import { z } from "zod";

export const samlConfigSchema = z.object({
  enabled: z.boolean(),
  entityId: z.string().url(),
  acsUrl: z.string().url(),
  sloUrl: z.string().url().optional(),
  idpMetadataUrl: z.string().url().optional(),
  idpEntityId: z.string(),
  idpSsoUrl: z.string().url(),
  idpCertificate: z.string(),
  nameIdFormat: z
    .string()
    .default(
      "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    ),
  attributeMap: z
    .object({
      email: z
        .string()
        .default(
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        ),
      displayName: z
        .string()
        .default(
          "http://schemas.microsoft.com/identity/claims/displayname",
        ),
      role: z
        .string()
        .default(
          "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
        ),
    })
    .default({
      email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      displayName: "http://schemas.microsoft.com/identity/claims/displayname",
      role: "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
    }),
  defaultRole: z.string().default("member"),
  adminRoleValue: z.string().default("TaskApp.Admin"),
  wantAssertionsSigned: z.boolean().default(true),
  wantResponseSigned: z.boolean().default(true),
  signatureAlgorithm: z.string().default("sha256"),
  digestAlgorithm: z.string().default("sha256"),
});

export type SamlConfig = z.infer<typeof samlConfigSchema>;
