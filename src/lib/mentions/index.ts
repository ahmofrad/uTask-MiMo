import { prisma } from "@/lib/db";

const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)|@(\w[\w\s.-]+)/g;

export type MentionMatch = {
  text: string;
  userId?: string;
  email?: string;
};

export function parseMentions(input: string): MentionMatch[] {
  const mentions: MentionMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = MENTION_REGEX.exec(input)) !== null) {
    if (match[1] && match[2]) {
      mentions.push({ text: match[1], userId: match[2] });
    } else if (match[3]) {
      mentions.push({ text: match[3].trim() });
    }
  }

  return mentions;
}

export function extractMentionedEmails(input: string): string[] {
  const mentions = parseMentions(input);
  return mentions
    .filter((m): m is MentionMatch & { email: string } => !!m.email)
    .map((m) => m.email!);
}

export async function resolveMentionTarget(mention: MentionMatch): Promise<string | null> {
  if (mention.userId) {
    const user = await prisma.user.findFirst({
      where: { id: mention.userId, status: "active" },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  const text = mention.text.trim();
  if (!text) return null;
  const user = await prisma.user.findFirst({
    where: {
      status: "active",
      OR: [
        { displayName: { equals: text, mode: "insensitive" } },
        { email: { equals: text, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return user?.id ?? null;
}

export function replaceMentionsWithDisplay(
  input: string,
  userMap: Map<string, { id: string; displayName: string }>,
): string {
  return input.replace(MENTION_REGEX, (match, _id, _userIdFallback, name) => {
    const userId = _id ? _userIdFallback : undefined;
    if (userId) {
      const user = userMap.get(userId);
      if (user) return `@[${user.displayName}](${user.id})`;
    }
    // Try resolving by name
    for (const [, u] of userMap) {
      if (u.displayName === name) return `@[${u.displayName}](${u.id})`;
    }
    return match;
  });
}
