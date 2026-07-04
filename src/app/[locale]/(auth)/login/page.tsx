import { LoginForm } from "@/components/auth/login-form";
import { getTranslations } from "next-intl/server";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  return (
    <>
      <h1 className="text-2xl font-bold text-fg-primary text-center">
        {t("title")}
      </h1>
      <LoginForm />
    </>
  );
}
