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
