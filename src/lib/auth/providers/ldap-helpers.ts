import { Client } from "ldapts";
import type { LdapConfig } from "../ldap-schema";

export function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (character) => {
    switch (character) {
      case "\\":
        return "\\5c";
      case "*":
        return "\\2a";
      case "(":
        return "\\28";
      case ")":
        return "\\29";
      default:
        return "\\00";
    }
  });
}

export async function bindAdmin(config: LdapConfig): Promise<Client> {
  const clientOpts: ConstructorParameters<typeof Client>[0] = { url: config.url };
  if (config.tlsCaCert) {
    clientOpts.tlsOptions = { ca: config.tlsCaCert, rejectUnauthorized: true };
  }
  const client = new Client(clientOpts);
  await client.bind(config.bindUpn, config.bindPassword);
  return client;
}