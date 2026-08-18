"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/components/ui/toast";

type ProjectTemplate = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  templateJson: {
    tasks?: Array<{ title: string; description?: string | null; priority?: string }>;
    customFields?: Array<{ name: string; key: string; type: string }>;
  };
  createdAt: string;
  createdBy: { id: string; displayName: string };
};

type TaskTemplate = {
  title: string;
  description: string;
  priority: string;
  estimatedHours: string;
  isMilestone: boolean;
};

type FieldTemplate = {
  name: string;
  key: string;
  type: string;
  required: boolean;
  options: string;
};

export function ProjectTemplatesManager() {
  const t = useTranslations("project");
  const router = useRouter();
  const { addToast } = useToast();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);

  // Create form
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState("#2563eb");
  const [formTasks, setFormTasks] = useState<TaskTemplate[]>([{ title: "", description: "", priority: "med", estimatedHours: "", isMilestone: false }]);
  const [formFields, setFormFields] = useState<FieldTemplate[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Apply form
  const [applyName, setApplyName] = useState("");
  const [applyDeptId, setApplyDeptId] = useState("");

  useEffect(() => {
    apiFetch("/api/v1/project-templates")
      .then((res) => res.json())
      .then((json) => setTemplates(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (submitting || !formName.trim()) return;
    setSubmitting(true);
    try {
      const validTasks = formTasks.filter((t) => t.title.trim());
      const templateJson = {
        tasks: validTasks.map((t) => ({
          title: t.title.trim(),
          description: t.description.trim() || null,
          priority: t.priority,
          estimatedHours: t.estimatedHours ? Number(t.estimatedHours) : null,
          isMilestone: t.isMilestone,
        })),
        customFields: formFields.filter((f) => f.name.trim() && f.key.trim()).map((f) => ({
          name: f.name.trim(),
          key: f.key.trim(),
          type: f.type,
          required: f.required,
          configJson: f.type === "select" || f.type === "multi_select"
            ? { options: f.options.split(",").map((o) => o.trim()).filter(Boolean) }
            : null,
        })),
      };

      const res = await apiFetch("/api/v1/project-templates", {
        method: "POST",
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim() || null,
          color: formColor,
          templateJson,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setTemplates((prev) => [json.data, ...prev]);
        setCreateDialogOpen(false);
        resetForm();
        addToast({ message: t("templateCreated") });
      } else {
        const json = await res.json().catch(() => ({}));
        addToast({ message: json.error?.message ?? t("createFailed") });
      }
    } catch {
      addToast({ message: t("createFailed") });
    }
    setSubmitting(false);
  }

  async function handleApply() {
    if (submitting || !selectedTemplate || !applyName.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/project-templates/${selectedTemplate.id}/apply`, {
        method: "POST",
        body: JSON.stringify({
          name: applyName.trim(),
          departmentId: applyDeptId || null,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setApplyDialogOpen(false);
        addToast({ message: t("templateApplied") });
        router.push(`/projects/${json.data.id}`);
      } else {
        const json = await res.json().catch(() => ({}));
        addToast({ message: json.error?.message ?? t("applyFailed") });
      }
    } catch {
      addToast({ message: t("applyFailed") });
    }
    setSubmitting(false);
  }

  function resetForm() {
    setFormName("");
    setFormDesc("");
    setFormColor("#2563eb");
    setFormTasks([{ title: "", description: "", priority: "med", estimatedHours: "", isMilestone: false }]);
    setFormFields([]);
  }

  function openApplyDialog(template: ProjectTemplate) {
    setSelectedTemplate(template);
    setApplyName(template.name);
    setApplyDeptId("");
    setApplyDialogOpen(true);
  }

  const inputClass = "w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg-primary">{t("templates")}</h2>
        <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
          {t("newTemplate")}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-fg-muted">{t("loading")}</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-fg-muted italic">{t("noTemplates")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-4 rounded-xl border border-border-primary bg-bg-surface hover:border-border-strong transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tpl.color }} />
                  <h3 className="font-medium text-fg-primary text-sm">{tpl.name}</h3>
                </div>
                <Button variant="outline" size="sm" onClick={() => openApplyDialog(tpl)}>
                  {t("useTemplate")}
                </Button>
              </div>
              {tpl.description && (
                <p className="text-xs text-fg-muted mb-2 line-clamp-2">{tpl.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-fg-tertiary">
                <span>{tpl.templateJson.tasks?.length ?? 0} {t("templateTasks").toLowerCase()}</span>
                <span>{tpl.templateJson.customFields?.length ?? 0} {t("templateFields").toLowerCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <div className="p-5 space-y-4 max-w-lg max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-fg-primary">{t("newTemplate")}</h3>

          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("fields.name")} *</label>
            <input className={inputClass} value={formName} onChange={(e) => setFormName(e.target.value)} required autoFocus />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("fields.description")}</label>
            <textarea className={inputClass} rows={2} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("fields.color")}</label>
            <input type="color" className="w-10 h-8 rounded border border-border-primary" value={formColor} onChange={(e) => setFormColor(e.target.value)} />
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-fg-secondary">{t("templateTasks")}</span>
              <button
                type="button"
                onClick={() => setFormTasks((prev) => [...prev, { title: "", description: "", priority: "med", estimatedHours: "", isMilestone: false }])}
                className="text-xs text-accent hover:underline"
              >
                + {t("templateAddTask")}
              </button>
            </div>
            {formTasks.map((task, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  className={inputClass + " flex-1"}
                  placeholder={t("templateTaskTitle")}
                  value={task.title}
                  onChange={(e) => {
                    const next = [...formTasks];
                    next[i] = { ...next[i]!, title: e.target.value };
                    setFormTasks(next);
                  }}
                />
                <select
                  className="w-24 px-2 py-1 border border-border-primary rounded bg-bg-primary text-fg-primary text-xs"
                  value={task.priority}
                  onChange={(e) => {
                    const next = [...formTasks];
                    next[i] = { ...next[i]!, priority: e.target.value };
                    setFormTasks(next);
                  }}
                >
                  <option value="low">{t("priority.low")}</option>
                  <option value="med">{t("priority.med")}</option>
                  <option value="high">{t("priority.high")}</option>
                  <option value="urgent">{t("priority.urgent")}</option>
                </select>
                <button
                  type="button"
                  onClick={() => setFormTasks((prev) => prev.filter((_, j) => j !== i))}
                  className="text-destructive text-xs px-2"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Custom Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-fg-secondary">{t("templateFields")}</span>
              <button
                type="button"
                onClick={() => setFormFields((prev) => [...prev, { name: "", key: "", type: "text", required: false, options: "" }])}
                className="text-xs text-accent hover:underline"
              >
                + {t("templateAddField")}
              </button>
            </div>
            {formFields.map((field, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input
                  className={inputClass + " flex-1"}
                  placeholder={t("templateFieldName")}
                  value={field.name}
                  onChange={(e) => {
                    const next = [...formFields];
                    next[i] = { ...next[i]!, name: e.target.value };
                    setFormFields(next);
                  }}
                />
                <select
                  className="w-24 px-2 py-1 border border-border-primary rounded bg-bg-primary text-fg-primary text-xs"
                  value={field.type}
                  onChange={(e) => {
                    const next = [...formFields];
                    next[i] = { ...next[i]!, type: e.target.value };
                    setFormFields(next);
                  }}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Select</option>
                  <option value="multi_select">Multi-select</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="url">URL</option>
                </select>
                <button
                  type="button"
                  onClick={() => setFormFields((prev) => prev.filter((_, j) => j !== i))}
                  className="text-destructive text-xs px-2"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void handleCreate()} disabled={submitting}>
              {submitting ? t("saving") : t("create")}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Apply Dialog */}
      <Dialog open={applyDialogOpen} onClose={() => setApplyDialogOpen(false)}>
        <div className="p-5 space-y-4 max-w-md">
          <h3 className="text-lg font-semibold text-fg-primary">{t("applyTemplate")}</h3>

          {selectedTemplate && (
            <div className="p-3 rounded-lg bg-bg-secondary border border-border-primary">
              <p className="text-sm font-medium text-fg-primary">{selectedTemplate.name}</p>
              <p className="text-xs text-fg-muted mt-1">
                {selectedTemplate.templateJson.tasks?.length ?? 0} {t("templateTasks").toLowerCase()},{" "}
                {selectedTemplate.templateJson.customFields?.length ?? 0} {t("templateFields").toLowerCase()}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("fields.name")} *</label>
            <input className={inputClass} value={applyName} onChange={(e) => setApplyName(e.target.value)} required autoFocus />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)} disabled={submitting}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void handleApply()} disabled={submitting}>
              {submitting ? t("saving") : t("create")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
