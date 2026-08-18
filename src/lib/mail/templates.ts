export type MailTemplate = {
  subject: string;
  text: string;
  html: string;
};

export type MailTemplateSet = {
  invite: MailTemplate;
  passwordReset: MailTemplate;
};

export const DEFAULT_MAIL_TEMPLATES: MailTemplateSet = {
  invite: {
    subject: "You've been invited to uTask",
    text: "You've been invited to join uTask. Use this link to set your password and join the team. It expires in {{expiryDays}} days:\n\n{{link}}",
    html: "<p>You've been invited to join uTask.</p><p>Use this link to set your password and join the team. It expires in {{expiryDays}} days:</p><p><a href=\"{{link}}\">Accept invitation</a></p>",
  },
  passwordReset: {
    subject: "Reset your uTask password",
    text: "Use this link to reset your password. It expires in {{expiryMinutes}} minutes:\n\n{{link}}",
    html: "<p>Use this link to reset your password. It expires in {{expiryMinutes}} minutes:</p><p><a href=\"{{link}}\">Reset password</a></p>",
  },
};

/** Replace {{placeholder}} tokens. Unknown tokens render as an empty string. */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value === undefined ? "" : String(value);
  });
}

/** Sample values substituted into rendered templates for previews and test sends. */
export const MAIL_PREVIEW_VARS: Record<string, string> = {
  link: "https://app.example.com/invite/sample-token",
  expiryDays: "7",
  expiryMinutes: "60",
  email: "member@example.com",
};

/**
 * Load the effective templates: defaults merged with any admin overrides
 * stored in settings. A blank override falls back to the default.
 */
export async function getMailTemplates(): Promise<MailTemplateSet> {
  let custom: Record<string, Partial<MailTemplate>> = {};
  try {
    const { getSettings } = await import("@/lib/settings");
    const allSettings = await getSettings("install", null);
    custom = (allSettings.mailTemplates ?? {}) as Record<string, Partial<MailTemplate>>;
  } catch {
    // Settings table may not exist yet (fresh install).
  }

  const merge = (key: keyof MailTemplateSet): MailTemplate => {
    const def = DEFAULT_MAIL_TEMPLATES[key];
    const override = custom[key] ?? {};
    return {
      subject: override.subject?.trim() || def.subject,
      text: override.text?.trim() || def.text,
      html: override.html?.trim() || def.html,
    };
  };

  return { invite: merge("invite"), passwordReset: merge("passwordReset") };
}
