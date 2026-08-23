"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export type TaskTemplate = {
  title: string;
  description: string;
  priority: string;
  estimatedHours: string;
  isMilestone: boolean;
};

export type FieldTemplate = {
  name: string;
  key: string;
  type: string;
  required: boolean;
  options: string;
};

type ProjectTemplate = {
  id: string;
  name: string;
  templateJson: {
    tasks?: Array<{ title: string; description?: string | null; priority?: string }>;
    customFields?: Array<{ name: string; key: string; type: string }>;
  };
};

type CreateDialogProps = {
  open: boolean;
  inputClass: string;
  formName: string;
  formDesc: string;
  formColor: string;
  formTasks: TaskTemplate[];
  formFields: FieldTemplate[];
  submitting: boolean;
  onClose: () => void;
  onNameChange: (_value: string) => void;
  onDescriptionChange: (_value: string) => void;
  onColorChange: (_value: string) => void;
  onAddTask: () => void;
  onUpdateTask: (_index: number, _patch: Partial<TaskTemplate>) => void;
  onRemoveTask: (_index: number) => void;
  onAddField: () => void;
  onUpdateField: (_index: number, _patch: Partial<FieldTemplate>) => void;
  onRemoveField: (_index: number) => void;
  onSubmit: () => void;
};

export function ProjectTemplateCreateDialog({
  open,
  inputClass,
  formName,
  formDesc,
  formColor,
  formTasks,
  formFields,
  submitting,
  onClose,
  onNameChange,
  onDescriptionChange,
  onColorChange,
  onAddTask,
  onUpdateTask,
  onRemoveTask,
  onAddField,
  onUpdateField,
  onRemoveField,
  onSubmit,
}: CreateDialogProps) {
  const t = useTranslations("project");
  const tField = useTranslations("customField");

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="p-5 space-y-4 max-w-lg max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-fg-primary">{t("newTemplate")}</h3>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("fields.name")} *</label>
          <input className={inputClass} value={formName} onChange={(e) => onNameChange(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("fields.description")}</label>
          <textarea className={inputClass} rows={2} value={formDesc} onChange={(e) => onDescriptionChange(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("fields.color")}</label>
          <input type="color" className="w-10 h-8 rounded border border-border-primary" value={formColor} onChange={(e) => onColorChange(e.target.value)} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-fg-secondary">{t("templateTasks")}</span>
            <button type="button" onClick={onAddTask} className="text-xs text-accent hover:underline">
              + {t("templateAddTask")}
            </button>
          </div>
          {formTasks.map((task, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                className={`${inputClass} flex-1`}
                placeholder={t("templateTaskTitle")}
                value={task.title}
                onChange={(e) => onUpdateTask(index, { title: e.target.value })}
              />
              <select
                className="w-24 px-2 py-1 border border-border-primary rounded bg-bg-primary text-fg-primary text-xs"
                value={task.priority}
                onChange={(e) => onUpdateTask(index, { priority: e.target.value })}
              >
                <option value="low">{t("priority.low")}</option>
                <option value="med">{t("priority.med")}</option>
                <option value="high">{t("priority.high")}</option>
                <option value="urgent">{t("priority.urgent")}</option>
              </select>
              <button type="button" onClick={() => onRemoveTask(index)} className="text-destructive text-xs px-2">
                ×
              </button>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-fg-secondary">{t("templateFields")}</span>
            <button type="button" onClick={onAddField} className="text-xs text-accent hover:underline">
              + {t("templateAddField")}
            </button>
          </div>
          {formFields.map((field, index) => (
            <div key={index} className="flex gap-2 mb-2 items-center">
              <input
                className={`${inputClass} flex-1`}
                placeholder={t("templateFieldName")}
                value={field.name}
                onChange={(e) => onUpdateField(index, { name: e.target.value })}
              />
              <select
                className="w-24 px-2 py-1 border border-border-primary rounded bg-bg-primary text-fg-primary text-xs"
                value={field.type}
                onChange={(e) => onUpdateField(index, { type: e.target.value })}
              >
                <option value="text">{tField("types.text")}</option>
                <option value="number">{tField("types.number")}</option>
                <option value="date">{tField("types.date")}</option>
                <option value="select">{tField("types.select")}</option>
                <option value="multi_select">{tField("types.multi_select")}</option>
                <option value="checkbox">{tField("types.checkbox")}</option>
                <option value="url">{tField("types.url")}</option>
              </select>
              <button type="button" onClick={() => onRemoveField(index)} className="text-destructive text-xs px-2">
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>{t("cancel")}</Button>
          <Button onClick={onSubmit} disabled={submitting}>{submitting ? t("saving") : t("create")}</Button>
        </div>
      </div>
    </Dialog>
  );
}

type ApplyDialogProps = {
  open: boolean;
  inputClass: string;
  template: ProjectTemplate | null;
  name: string;
  submitting: boolean;
  onClose: () => void;
  onNameChange: (_value: string) => void;
  onSubmit: () => void;
};

export function ProjectTemplateApplyDialog({
  open,
  inputClass,
  template,
  name,
  submitting,
  onClose,
  onNameChange,
  onSubmit,
}: ApplyDialogProps) {
  const t = useTranslations("project");

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="p-5 space-y-4 max-w-md">
        <h3 className="text-lg font-semibold text-fg-primary">{t("applyTemplate")}</h3>
        {template && (
          <div className="p-3 rounded-lg bg-bg-secondary border border-border-primary">
            <p className="text-sm font-medium text-fg-primary">{template.name}</p>
            <p className="text-xs text-fg-muted mt-1">
              {template.templateJson.tasks?.length ?? 0} {t("templateTasks").toLowerCase()}, {" "}
              {template.templateJson.customFields?.length ?? 0} {t("templateFields").toLowerCase()}
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">{t("fields.name")} *</label>
          <input className={inputClass} value={name} onChange={(e) => onNameChange(e.target.value)} required autoFocus />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>{t("cancel")}</Button>
          <Button onClick={onSubmit} disabled={submitting}>{submitting ? t("saving") : t("create")}</Button>
        </div>
      </div>
    </Dialog>
  );
}
