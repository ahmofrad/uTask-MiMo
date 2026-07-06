import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("common");

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-fg-muted">{t("loading")}</p>
    </div>
  );
}
