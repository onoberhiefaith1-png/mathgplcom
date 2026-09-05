import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n/LanguageProvider";

export interface CreateNotebookValues {
  teacher: string;
  class_name: string;
  session: string;
  subject: string;
  topic: string;
  subtopic: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (v: CreateNotebookValues) => Promise<void> | void;
}

/** Academic sessions 2020/2021 → 2099/2100. */
const SESSIONS = Array.from({ length: 80 }, (_, i) => `${2020 + i}/${2021 + i}`);

/** Academic year rolls over in September. */
const currentSession = () => {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const candidate = `${start}/${start + 1}`;
  return SESSIONS.includes(candidate) ? candidate : SESSIONS[SESSIONS.length - 1];
};

const blank = (session: string): CreateNotebookValues => ({
  teacher: "",
  class_name: "",
  session,
  subject: "Mathematics", // editable default only
  topic: "",
  subtopic: "",
});

export const CreateNotebookDialog = ({ open, onOpenChange, onCreate }: Props) => {
  const { user } = useAuth();
  const t = useT();
  const defaultSession = useMemo(currentSession, []);
  const [v, setV] = useState<CreateNotebookValues>(() => blank(defaultSession));
  const [busy, setBusy] = useState(false);

  const teacherName = useMemo(() => {
    const m = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const name = (m.full_name ?? m.name ?? m.display_name) as string | undefined;
    return typeof name === "string" ? name.trim() : "";
  }, [user]);

  // Fresh form every time the dialog opens — no leftover example data.
  useEffect(() => {
    if (!open) return;
    setV({ ...blank(defaultSession), teacher: teacherName });
  }, [open, defaultSession, teacherName]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onCreate(v);
      setV({ ...blank(defaultSession), teacher: teacherName });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("notebook_new")}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t("notebook_new_hint")}
          </p>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <Field
            label={t("term_subject")}
            value={v.subject}
            onChange={(x) => setV({ ...v, subject: x })}
            placeholder={t("notebook_type_subject")}
            required
          />
          <Field label={t("term_topic")} value={v.topic} onChange={(x) => setV({ ...v, topic: x })} placeholder={t("notebook_type_topic")} required />
          <Field
            label={t("notebook_subtopic")}
            value={v.subtopic}
            onChange={(x) => setV({ ...v, subtopic: x })}
            placeholder={t("notebook_type_subtopic")}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("term_class")}</Label>
              <Input
                value={v.class_name}
                onChange={(e) => setV({ ...v, class_name: e.target.value })}
                placeholder={t("notebook_type_class")}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("notebook_academic_session")}</Label>
              <Select value={v.session} onValueChange={(x) => setV({ ...v, session: x })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("notebook_select_session")} />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {SESSIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Field
            label={t("term_teacher")}
            value={v.teacher}
            onChange={(x) => setV({ ...v, teacher: x })}
            placeholder={t("notebook_type_teacher")}
            required
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("action_cancel")}
            </Button>
            <Button type="submit" disabled={busy || !v.class_name.trim()}>
              {busy ? t("notebook_creating") : t("notes_create_notebook")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Field = (props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) => (
  <div className="space-y-1.5">
    <Label>{props.label}</Label>
    <Input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      required={props.required}
    />
  </div>
);

export default CreateNotebookDialog;
