"use client";

import { memo, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/components/ui/toast";
import {
  ProjectTemplateApplyDialog,
  ProjectTemplateCreateDialog,
  type FieldTemplate,
  type TaskTemplate,
} from "@/components/project/project-template-dialogs";

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

const EMPTY_TASK: TaskTemplate = {
  title: "",
  description: "",
  priority: "med",
  estimatedHours: "",
  isMilestone: false,
};

export const ProjectTemplatesManager = memo(function ProjectTemplatesManager() {
  const t = useTranslations("project");
  const router = useRouter();
  const { addToast } = useToast();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState("#4f46e5");
  const [formTasks, setFormTasks] = useState<TaskTemplate[]>([{ ...EMPTY_TASK }]);
  const [formFields, setFormFields] = useState<FieldTemplate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [applyName, setApplyName] = useState("");

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
      const validTasks = formTasks.filter((task) => task.title.trim());
      const templateJson = {
        tasks: validTasks.map((task) => ({
          title: task.title.trim(),
          description: task.description.trim() || null,
          priority: task.priority,
          estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : null,
          isMilestone: task.isMilestone,
        })),
        customFields: formFields
          .filter((field) => field.name.trim() && field.key.trim())
          .map((field) => ({
            name: field.name.trim(),
            key: field.key.trim(),
            type: field.type,
            required: field.required,
            configJson:
              field.type === "select" || field.type === "multi_select"
                ? { options: field.options.split(",").map((option) => option.trim()).filter(Boolean) }
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
        setTemplates((previous) => [json.data, ...previous]);
        setCreateDialogOpen(false);
        resetForm();
        addToast({ message: t("templateCreated") });
      } else {
        const json = await res.json().catch(() => ({}));
        addToast({ message: json.error?.message ?? t("createFailed") });
      }
    } catch {
      addToast({ message: t("createFailed") });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApply() {
    if (submitting || !selectedTemplate || !applyName.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/project-templates/${selectedTemplate.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ name: applyName.trim(), departmentId: null }),
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
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFormName("");
    setFormDesc("");
    setFormColor("#4f46e5");
    setFormTasks([{ ...EMPTY_TASK }]);
    setFormFields([]);
  }

  function openApplyDialog(template: ProjectTemplate) {
    setSelectedTemplate(template);
    setApplyName(template.name);
    setApplyDialogOpen(true);
  }

  function updateTask(index: number, patch: Partial<TaskTemplate>) {
    setFormTasks((previous) => previous.map((task, current) => current === index ? { ...task, ...patch } : task));
  }

  function updateField(index: number, patch: Partial<FieldTemplate>) {
    setFormFields((previous) => previous.map((field, current) => current === index ? { ...field, ...patch } : field));
  }

  const inputClass = "w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg-primary">{t("templates")}</h2>
        <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}>{t("newTemplate")}</Button>
      </div>

      {loading ? (
        <p className="text-sm text-fg-muted">{t("loading")}</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-fg-muted italic">{t("noTemplates")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((template) => (
            <div key={template.id} className="p-4 rounded-xl border border-border-primary bg-bg-surface hover:border-border-strong transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: template.color }} />
                  <h3 className="font-medium text-fg-primary text-sm">{template.name}</h3>
                </div>
                <Button variant="outline" size="sm" onClick={() => openApplyDialog(template)}>{t("useTemplate")}</Button>
              </div>
              {template.description && <p className="text-xs text-fg-muted mb-2 line-clamp-2">{template.description}</p>}
              <div className="flex items-center gap-3 text-xs text-fg-tertiary">
                <span>{template.templateJson.tasks?.length ?? 0} {t("templateTasks").toLowerCase()}</span>
                <span>{template.templateJson.customFields?.length ?? 0} {t("templateFields").toLowerCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectTemplateCreateDialog
        open={createDialogOpen}
        inputClass={inputClass}
        formName={formName}
        formDesc={formDesc}
        formColor={formColor}
        formTasks={formTasks}
        formFields={formFields}
        submitting={submitting}
        onClose={() => setCreateDialogOpen(false)}
        onNameChange={setFormName}
        onDescriptionChange={setFormDesc}
        onColorChange={setFormColor}
        onAddTask={() => setFormTasks((previous) => [...previous, { ...EMPTY_TASK }])}
        onUpdateTask={updateTask}
        onRemoveTask={(index) => setFormTasks((previous) => previous.filter((_, current) => current !== index))}
        onAddField={() => setFormFields((previous) => [...previous, { name: "", key: "", type: "text", required: false, options: "" }])}
        onUpdateField={updateField}
        onRemoveField={(index) => setFormFields((previous) => previous.filter((_, current) => current !== index))}
        onSubmit={() => void handleCreate()}
      />

      <ProjectTemplateApplyDialog
        open={applyDialogOpen}
        inputClass={inputClass}
        template={selectedTemplate}
        name={applyName}
        submitting={submitting}
        onClose={() => setApplyDialogOpen(false)}
        onNameChange={setApplyName}
        onSubmit={() => void handleApply()}
      />
    </div>
  );
});
