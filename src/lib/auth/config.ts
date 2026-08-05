import NextAuth from "next-auth";
import { cache } from "react";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { verifySsoToken } from "@/lib/auth/sso-token";
import { createSession, getSession, revokeSession, revokeAllUserSessions } from "@/lib/auth/session-store";
import type { Session } from "next-auth";

const { handlers: nextAuthHandlers, auth: nextAuth, signIn: nextAuthSignIn, signOut: nextAuthSignOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: { email: {}, password: {}, ssoToken: {} },
      authorize: async (credentials) => {
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

          const role = await getGlobalRole(user.id);
          const sessionId = await createSession(user.id, user.email, role);

          return { id: user.id, email: user.email, name: user.displayName, image: user.avatarUrl, sessionId };
        }

        if (!credentials?.email) return null;
        const email = String(credentials.email);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        if (user.status !== "active") return null;

        const password = String(credentials.password ?? "");
        if (!password || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        const role = await getGlobalRole(user.id);
        const sessionId = await createSession(user.id, user.email, role);

        return { id: user.id, email: user.email, name: user.displayName, image: user.avatarUrl, sessionId };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.sessionId = (user as { sessionId: string }).sessionId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      const sessionId = token.sessionId as string | undefined;
      if (!sessionId) return session;

      const sessionData = await getSession(sessionId);
      if (!sessionData) return session;

      session.user.id = sessionData.userId;
      session.user.email = sessionData.email;
      (session as unknown as { sessionId: string }).sessionId = sessionId;
      (session.user as unknown as { role: string | null }).role = sessionData.role;

      return session;
    },
  },
});

async function getGlobalRole(userId: string): Promise<string | null> {
  const role = await prisma.role.findFirst({
    where: { userId, scopeType: "global", scopeId: null },
    select: { type: true },
  });
  return role?.type ?? null;
}

export const auth = cache(async (): Promise<Session | null> => {
  const nextAuthSession = await nextAuth();
  if (!nextAuthSession?.user?.id) return null;

  const sessionId = (nextAuthSession as unknown as { sessionId?: string }).sessionId;
  if (!sessionId) return null;

  const sessionData = await getSession(sessionId);
  if (!sessionData) return null;

  return nextAuthSession;
});

export async function revokeCurrentSession(): Promise<void> {
  const nextAuthSession = await nextAuth();
  const sessionId = (nextAuthSession as unknown as { sessionId?: string }).sessionId;
  if (sessionId) {
    await revokeSession(sessionId);
  }
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await revokeAllUserSessions(userId);
}

export const handlers = nextAuthHandlers;
export const signIn = nextAuthSignIn;
export const signOut = nextAuthSignOut;