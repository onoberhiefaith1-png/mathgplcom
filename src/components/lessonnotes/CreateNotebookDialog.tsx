import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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

const empty: CreateNotebookValues = {
  teacher: "",
  class_name: "",
  session: "2025/2026",
  subject: "Mathematics",
  topic: "",
  subtopic: "",
};

export const CreateNotebookDialog = ({ open, onOpenChange, onCreate }: Props) => {
  const [v, setV] = useState<CreateNotebookValues>(empty);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onCreate(v);
      setV(empty);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New notebook</DialogTitle>
          <p className="text-xs text-muted-foreground">
            One notebook = one lesson topic. You can add more sections inside later.
          </p>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Subject" value={v.subject} onChange={(x) => setV({ ...v, subject: x })} placeholder="Mathematics" required />
          <Field label="Topic" value={v.topic} onChange={(x) => setV({ ...v, topic: x })} placeholder="Logarithm" required />
          <Field label="Subtopic" value={v.subtopic} onChange={(x) => setV({ ...v, subtopic: x })} placeholder="Logarithm Operations" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class" value={v.class_name} onChange={(x) => setV({ ...v, class_name: x })} placeholder="SS2" required />
            <Field label="Session" value={v.session} onChange={(x) => setV({ ...v, session: x })} placeholder="2025/2026" required />
          </div>
          <Field label="Teacher" value={v.teacher} onChange={(x) => setV({ ...v, teacher: x })} placeholder="Mr. Daniel" required />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create notebook"}
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
