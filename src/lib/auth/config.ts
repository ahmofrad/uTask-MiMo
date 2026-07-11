import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { verifySsoToken } from "@/lib/auth/sso-token";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: { email: {}, password: {}, ssoToken: {} },
      authorize: async (credentials) => {
        // SSO-verified login: the user was authenticated by an external
        // identity provider (LDAP/SAML). Trust is established only via a
        // server-signed, short-lived token minted by the SSO route handler —
        // never by a client-supplied boolean flag.
        const ssoToken = credentials?.ssoToken ? String(credentials.ssoToken) : undefined;
        if (ssoToken) {
          const verified = verifySsoToken(ssoToken);
          const email = credentials.email ? String(credentials.email) : undefined;
          if (!verified) return null;
          if (email && verified.email !== email) return null;

          const user = await prisma.user.findUnique({ where: { email: verified.email } });
          if (!user || user.status !== "active") return null;

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
          return {
            id: user.id,
            email: user.email,
            name: user.displayName,
            image: user.avatarUrl,
          };
        }

        if (!credentials?.email) {
          return null;
        }
        const email = String(credentials.email);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        if (user.status !== "active") return null;

        // Local login: require password
        const password = String(credentials.password ?? "");
        if (!password || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        const userId = user.id as string;
        token.userId = userId;
        token.email = user.email ?? null;
        // Fetch and include global role in JWT to avoid DB hit on every RBAC check
        const role = await prisma.role.findFirst({
          where: { userId, scopeType: "global", scopeId: null },
          select: { type: true },
        });
        token.role = role?.type ?? null;
      }
      if (trigger === "update" && session) {
        token.email = session.email;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      if (token.role) {
        (session.user as unknown as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
});
