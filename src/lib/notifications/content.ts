type NotificationPayload = {
  taskTitle?: string;
  message?: string;
  by?: string;
  [key: string]: unknown;
};

/**
 * Derive a localized title + body for a notification from its type and payload.
 * No schema change — the Notification model has no title/body columns, so the
 * human-readable text is computed at render time from `type` + `payloadJson`.
 */
export function notificationContent(
  type: string,
  payload: NotificationPayload | null | undefined,
  t: (_key: string, _values?: Record<string, string | number | Date>) => string,
): { title: string; body: string } {
  const task = payload?.taskTitle ?? "";
  const by = payload?.by ?? "";
  const departmentName = typeof payload?.departmentName === "string" ? payload.departmentName : "";
  const projectName = typeof payload?.projectName === "string" ? payload.projectName : "";

  switch (type) {
    case "assigned": {
      const body = task
        ? t("assignedBody", { task })
        : typeof payload?.message === "string"
          ? payload.message
          : t("assignedTitle");
      return { title: t("assignedTitle"), body };
    }
    case "commented":
      return { title: t("commentedTitle"), body: t("commentedBody", { task }) };
    case "mentioned":
      return { title: t("mentionedTitle"), body: t("mentionedBody", { task, by }) };
    case "status_changed":
      return { title: t("statusChangedTitle"), body: t("statusChangedBody", { task }) };
    case "due_soon":
      return { title: t("dueSoonTitle"), body: t("dueSoonBody", { task }) };
    case "department_link_request":
      return {
        title: t("departmentLinkRequestTitle"),
        body: t("departmentLinkRequestBody", { department: departmentName, project: projectName }),
      };
    default:
      return { title: type.replace(/_/g, " "), body: "" };
  }
}
