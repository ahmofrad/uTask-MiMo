export const samlProvider = {
  async startLogin(_orgSlug: string) {
    throw new Error("SAML provider not yet implemented");
  },
  async handleCallback(_rawResponse: string) {
    throw new Error("SAML provider not yet implemented");
  },
};
