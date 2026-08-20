import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { getInstanceSetting, setInstanceSetting } from "@/lib/settings/instance";
import { logAudit } from "@/lib/audit/log";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { PROVIDER_DEFAULT_BASE_URLS } from "@/lib/date/holidays/countries";
import {
  API_KEY_MASK,
  apiKeyState,
  encryptApiKey,
  HOLIDAY_EGRESS_SETTING_KEY,
  holidayEgressConfigSchema,
  normalizeHolidayEgress,
} from "@/lib/date/holidays/download";

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(new Request("http://localhost"), { params: {} });
  if (guardResult) return guardResult;

  const stored = await getInstanceSetting(HOLIDAY_EGRESS_SETTING_KEY, undefined);
  const egress = normalizeHolidayEgress(stored);
  // Report the key truthfully: only mask it when it actually decrypts. A
  // stored blob that fails to decrypt (encryption key changed between
  // restarts/deployments) must come back as `keyState: "broken"` with an
  // empty apiKey, so the admin re-enters it instead of seeing a phantom key.
  const keyState = apiKeyState(egress.apiKey);
  return NextResponse.json({
    data: { ...egress, apiKey: keyState === "ok" ? API_KEY_MASK : "", keyState },
  });
}

export async function PUT(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = holidayEgressConfigSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const before = normalizeHolidayEgress(
    await getInstanceSetting(HOLIDAY_EGRESS_SETTING_KEY, undefined),
  );

  // Keep the stored key only when the client submits the mask (unchanged)
  // AND the stored key is still decryptable. An undecryptable blob is
  // useless — drop it so the admin is forced to re-enter a working key.
  const storedKeyState = apiKeyState(before.apiKey);
  const incoming = parsed.data;
  const apiKey =
    incoming.apiKey && incoming.apiKey !== API_KEY_MASK
      ? encryptApiKey(incoming.apiKey)
      : storedKeyState === "ok"
        ? before.apiKey
        : "";

  // The base URL is derived from the provider, never taken from the client
  // (a switched provider must not keep the old host).
  const toStore = {
    ...incoming,
    baseUrl: PROVIDER_DEFAULT_BASE_URLS[incoming.provider],
    apiKey,
  };
  await setInstanceSetting(HOLIDAY_EGRESS_SETTING_KEY, toStore, userId);

  await logAudit({
    actorUserId: userId,
    action: "settings_updated",
    entityType: "settings",
    entityId: "holiday-egress",
    before: { enabled: before.enabled, provider: before.provider, countryCode: before.countryCode },
    after: { enabled: toStore.enabled, provider: toStore.provider, countryCode: toStore.countryCode },
  });

  return NextResponse.json({
    data: { ...toStore, apiKey: apiKey ? API_KEY_MASK : "", keyState: apiKeyState(apiKey) },
  });
}
