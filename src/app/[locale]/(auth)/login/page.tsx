import { LoginForm } from "@/components/auth/login-form";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-app px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-fg-primary tracking-tight">uTask</h1>
        </div>

        {/* Card */}
        <div className="bg-bg-surface rounded-2xl shadow-lg border border-border-primary p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-fg-primary">{t("title")}</h2>
            <p className="text-sm text-fg-muted mt-1">Welcome back. Sign in to continue.</p>
          </div>

          {/* Form */}
          <LoginForm />

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-primary"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-bg-surface text-fg-subtle">or</span>
            </div>
          </div>

          {/* SSO Button */}
          <Link
            href="/login/sso"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border-primary text-fg-secondary hover:bg-bg-surface-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Sign in with SSO
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-fg-muted mt-6">
          Don&apos;t have an account?{" "}
          Ask your admin to invite you.
        </p>
      </div>
    </div>
  );
}
