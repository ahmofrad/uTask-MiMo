import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import type { Permission } from "@/lib/rbac/roles";
import { NextResponse } from "next/server";

type HandlerContext = { userId: string };
type ApiHandler = (
  _request: Request,
  _context: HandlerContext,
) => Promise<NextResponse>;

export function requirePermission(permission: Permission) {
  return (handler: ApiHandler): ApiHandler => {
    return async (request: Request, _context: HandlerContext) => {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
          { status: 401 },
        );
      }

      const allowed = await can(session.user.id, permission);
      if (!allowed) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
          { status: 403 },
        );
      }

      return handler(request, { userId: session.user.id });
    };
  };
}
