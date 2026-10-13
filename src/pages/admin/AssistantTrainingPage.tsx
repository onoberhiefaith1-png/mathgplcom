import { useCallback, useEffect, useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  attachmentReading,
  type TrainingAttachment,
} from "@/lib/assistantTraining/attachments";
import {
  EXAMPLE_KINDS,
  addTrainingExample,
  createStudyReport,
  saveGuidanceVersion,
  sendTrainingMessage,
  trainingOverview,
  updateStudyReport,
  updateTrainingExample,
} from "@/lib/assistantTraining/training.functions";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const TABS = [
  "Conversation",
  "Reference library",
  "Study reports",
  "Approved guidance",
  "Testing",
  "Capability map",
] as const;

const card = "rounded-xl border border-border bg-card p-4 text-card-foreground";

async function upload(files: FileList | null): Promise<TrainingAttachment[]> {
  const out: TrainingAttachment[] = [];
  for (const f of Array.from(files ?? [])) {
    const path = `${crypto.randomUUID()}/${f.name.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await supabase.storage
      .from("assistant-training")
      .upload(path, f, { contentType: f.type });
    if (error) throw new Error(error.message);
    out.push({ path, name: f.name, mime: f.type, size: f.size });
  }
  return out;
}

const Usage = ({ u }: { u?: Row | null }) =>
  u ? (
    <p className="mt-1 text-[11px] text-muted-foreground">
      {u.model} · {u.inputTokens} in / {u.outputTokens} out tokens · ≈
      {u.estimatedPence}p (estimate)
    </p>
  ) : null;

const AttachList = ({ list }: { list?: TrainingAttachment[] }) =>
  list?.length ? (
    <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
      {list.map((a) => (
        <li key={a.path}>
          📎 {a.name} —{" "}
          {attachmentReading(a.mime) === "studied"
            ? "image, viewed"
            : "name only, not studied"}
        </li>
      ))}
    </ul>
  ) : null;

const AssistantTrainingPage = () => {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Conversation");
  const [data, setData] = useState<{
    messages: Row[];
    examples: Row[];
    reports: Row[];
    versions: Row[];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(JSON.parse((await trainingOverview()).json));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      if (done) toast.success(done);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell
      title="Assistant Training"
      subtitle="Teach connected assistants how MathGPL should work. Nothing reaches teachers until you approve a guidance version."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={t === tab ? "default" : "outline"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      {!data ? (
        <div className={card}>
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : tab === "Conversation" ? (
        <Conversation messages={data.messages} busy={busy} run={run} />
      ) : tab === "Reference library" ? (
        <Library examples={data.examples} busy={busy} run={run} />
      ) : tab === "Study reports" ? (
        <Reports
          reports={data.reports}
          examples={data.examples}
          busy={busy}
          run={run}
        />
      ) : tab === "Approved guidance" ? (
        <Guidance
          versions={data.versions}
          reports={data.reports}
          examples={data.examples}
          busy={busy}
          run={run}
        />
      ) : tab === "Testing" ? (
        <div className={card}>
          <p className="text-sm">
            Testing starts after you approve the first guidance version. Then a
            fresh ChatGPT session loads it through <b>get_operating_guide</b>,
            which reports the approved version number it received.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            AI usage recorded so far (training conversation and reports):{" "}
            {sumUsage([...data.messages, ...data.reports])}
          </p>
        </div>
      ) : (
        <CapabilityMap />
      )}
    </DashboardShell>
  );
};

function sumUsage(rows: Row[]) {
  let i = 0,
    o = 0,
    p = 0;
  for (const r of rows)
    if (r.usage) {
      i += r.usage.inputTokens ?? 0;
      o += r.usage.outputTokens ?? 0;
      p += r.usage.estimatedPence ?? 0;
    }
  return `${i} input / ${o} output tokens, ≈${p.toFixed(2)}p estimated`;
}

type RunFn = (fn: () => Promise<unknown>, done?: string) => Promise<void>;

const Conversation = ({
  messages,
  busy,
  run,
}: {
  messages: Row[];
  busy: boolean;
  run: RunFn;
}) => {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  return (
    <div className={card}>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Explain how a feature should work, or ask what the system currently
            understands.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "admin"
                ? "ml-auto max-w-[85%] rounded-lg bg-primary p-3 text-primary-foreground"
                : "max-w-[90%]"
            }
          >
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
            <AttachList list={m.attachments} />
            {m.role === "assistant" && <Usage u={m.usage} />}
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write an instruction or a correction…"
          rows={3}
        />
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" /> Attach screenshots, documents
            or videos
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setFiles(e.target.files)}
            />
            {files?.length ? <span>({files.length})</span> : null}
          </label>
          <Button
            size="sm"
            disabled={busy || !text.trim()}
            onClick={() =>
              void run(async () => {
                const attachments = await upload(files);
                await sendTrainingMessage({
                  data: { body: text, attachments },
                });
                setText("");
                setFiles(null);
              })
            }
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}{" "}
            Send
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Screenshots are viewed. Videos and documents are stored but not
          studied — the assistant sees only their names.
        </p>
      </div>
    </div>
  );
};

const Library = ({
  examples,
  busy,
  run,
}: {
  examples: Row[];
  busy: boolean;
  run: RunFn;
}) => {
  const [kind, setKind] =
    useState<(typeof EXAMPLE_KINDS)[number]>("lesson_note");
  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [verdict, setVerdict] = useState<"correct" | "incorrect" | "partial">(
    "correct",
  );
  const [why, setWhy] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  return (
    <div className="space-y-4">
      <div className={`${card} space-y-2`}>
        <p className="text-sm font-semibold">Add a reference example</p>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            {EXAMPLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            value={verdict}
            onChange={(e) => setVerdict(e.target.value as typeof verdict)}
          >
            <option value="correct">Correct example</option>
            <option value="partial">Partly correct</option>
            <option value="incorrect">Incorrect example</option>
          </select>
        </div>
        <Input
          placeholder="Lesson note ID (from its address) — captures its stored note, highlights and Floating Numbers"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value.trim())}
        />
        <Input
          placeholder="Title (optional for lesson notes)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          rows={3}
          placeholder="Why is this example correct or incorrect?"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
        />
        <input
          type="file"
          multiple
          className="text-xs"
          onChange={(e) => setFiles(e.target.files)}
        />
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const attachments = await upload(files);
              await addTrainingExample({
                data: {
                  kind,
                  sourceId: sourceId || undefined,
                  title: title || undefined,
                  verdict,
                  explanation: why,
                  attachments,
                },
              });
              setSourceId("");
              setTitle("");
              setWhy("");
              setFiles(null);
            }, "Example added.")
          }
        >
          Add example
        </Button>
      </div>
      {examples.map((e) => (
        <div key={e.id} className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {e.title}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                · {e.kind} · {e.verdict} ·{" "}
                {e.hasSnapshot ? "stored data captured" : "no stored data"}
              </span>
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={e.approved ? "default" : "outline"}
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    updateTrainingExample({
                      data: { id: e.id, approved: !e.approved },
                    }),
                  )
                }
              >
                {e.approved ? "Approved for sharing" : "Approve for sharing"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    updateTrainingExample({ data: { id: e.id, remove: true } }),
                  )
                }
              >
                Remove
              </Button>
            </div>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {e.explanation}
          </p>
          <AttachList list={e.attachments} />
        </div>
      ))}
    </div>
  );
};

const Reports = ({
  reports,
  examples,
  busy,
  run,
}: {
  reports: Row[];
  examples: Row[];
  busy: boolean;
  run: RunFn;
}) => {
  const [pick, setPick] = useState<string[]>([]);
  return (
    <div className="space-y-4">
      <div className={`${card} space-y-2`}>
        <p className="text-sm font-semibold">
          Study selected examples (up to 8)
        </p>
        {examples.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Add reference examples first.
          </p>
        )}
        {examples.map((e) => (
          <label key={e.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pick.includes(e.id)}
              onChange={(ev) =>
                setPick((p) =>
                  ev.target.checked
                    ? [...p, e.id].slice(0, 8)
                    : p.filter((x) => x !== e.id),
                )
              }
            />
            {e.title}{" "}
            <span className="text-xs text-muted-foreground">
              ({e.kind}, {e.verdict})
            </span>
          </label>
        ))}
        <Button
          size="sm"
          disabled={busy || !pick.length}
          onClick={() =>
            void run(
              () => createStudyReport({ data: { exampleIds: pick } }),
              "Report written.",
            )
          }
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Write
          study report
        </Button>
      </div>
      {reports.map((r) => (
        <ReportCard key={r.id} r={r} busy={busy} run={run} />
      ))}
    </div>
  );
};

const ReportCard = ({
  r,
  busy,
  run,
}: {
  r: Row;
  busy: boolean;
  run: RunFn;
}) => {
  const [corr, setCorr] = useState<string>(r.corrections ?? "");
  return (
    <div className={card}>
      <p className="text-sm font-semibold">
        {r.title}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          · {r.status}
        </span>
      </p>
      <Usage u={r.usage} />
      <pre className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap font-sans text-sm">
        {r.body}
      </pre>
      <Textarea
        className="mt-2"
        rows={3}
        placeholder="Your corrections to this report"
        value={corr}
        onChange={(e) => setCorr(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(
              () =>
                updateStudyReport({
                  data: { id: r.id, corrections: corr, status: "corrected" },
                }),
              "Corrections saved.",
            )
          }
        >
          Save corrections
        </Button>
        <Button
          size="sm"
          disabled={busy || r.status === "approved"}
          onClick={() =>
            void run(
              () =>
                updateStudyReport({
                  data: { id: r.id, corrections: corr, status: "approved" },
                }),
              "Report approved.",
            )
          }
        >
          Approve report
        </Button>
      </div>
    </div>
  );
};

const Guidance = ({
  versions,
  reports,
  examples,
  busy,
  run,
}: {
  versions: Row[];
  reports: Row[];
  examples: Row[];
  busy: boolean;
  run: RunFn;
}) => {
  const [m, setM] = useState("");
  const [rec, setRec] = useState("");
  const [t, setT] = useState("");
  const [note, setNote] = useState("");
  const [reportId, setReportId] = useState("");
  const [ex, setEx] = useState<string[]>([]);
  const approvedReports = reports.filter((r) => r.status === "approved");
  const save = (approve: boolean) =>
    run(
      () =>
        saveGuidanceVersion({
          data: {
            mandatory: m,
            recommended: rec,
            techniques: t,
            changeNote: note,
            reportId: reportId || undefined,
            exampleIds: ex,
            approve,
          },
        }),
      approve
        ? "Guidance approved — connected assistants now receive it."
        : "Draft saved.",
    );
  return (
    <div className="space-y-4">
      <div className={`${card} space-y-2`}>
        <p className="text-sm font-semibold">New guidance version</p>
        <select
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={reportId}
          onChange={(e) => {
            setReportId(e.target.value);
            const r = approvedReports.find((x) => x.id === e.target.value);
            if (r) {
              setT(
                (v) =>
                  v ||
                  `${r.body}\n\nAdministrator corrections:\n${r.corrections}`,
              );
              setEx(r.example_ids ?? []);
            }
          }}
        >
          <option value="">Based on approved report (optional)</option>
          {approvedReports.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
        <Textarea
          rows={4}
          placeholder="MANDATORY platform requirements"
          value={m}
          onChange={(e) => setM(e.target.value)}
        />
        <Textarea
          rows={4}
          placeholder="RECOMMENDED teaching practice (teachers may override)"
          value={rec}
          onChange={(e) => setRec(e.target.value)}
        />
        <Textarea
          rows={4}
          placeholder="TECHNIQUES shown by examples (not compulsory)"
          value={t}
          onChange={(e) => setT(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Linked examples (must be approved for sharing):
        </p>
        {examples.map((e) => (
          <label key={e.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ex.includes(e.id)}
              onChange={(ev) =>
                setEx((p) =>
                  ev.target.checked
                    ? [...p, e.id]
                    : p.filter((x) => x !== e.id),
                )
              }
            />
            {e.title}{" "}
            {e.approved ? (
              ""
            ) : (
              <span className="text-xs text-muted-foreground">
                (not approved)
              </span>
            )}
          </label>
        ))}
        <Input
          placeholder="What changed in this version?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !note.trim()}
            onClick={() => void save(false)}
          >
            Save draft
          </Button>
          <Button
            size="sm"
            disabled={busy || !note.trim()}
            onClick={() => void save(true)}
          >
            Approve and publish to assistants
          </Button>
        </div>
      </div>
      {versions.map((v) => (
        <div key={v.id} className={card}>
          <p className="text-sm font-semibold">
            Version {v.version}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              · {v.status} · {v.change_note}
            </span>
          </p>
          {(["mandatory", "recommended", "techniques"] as const).map((k) =>
            v[k] ? (
              <div key={k} className="mt-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {k}
                </p>
                <p className="whitespace-pre-wrap text-sm">{v[k]}</p>
              </div>
            ) : null,
          )}
        </div>
      ))}
    </div>
  );
};

const CAPS: [string, string, string][] = [
  [
    "Lesson note + standards",
    "get_operating_guide, get_lesson_standards, save_structured_lesson, read_lesson_note",
    "Available",
  ],
  [
    "Repair old notes",
    "preview_lesson_repair → snapshot_lesson_note → repair_lesson_structure",
    "Needs teacher approval",
  ],
  [
    "Highlighting",
    "highlight_solution, edit_highlights",
    "Partial — read-back not enforced",
  ],
  [
    "Floating Numbers",
    "generate_floating (uses MathGPL credits), read_floating_numbers",
    "Partial",
  ],
  [
    "Smartboard",
    "smartboard_test, open_screen, smartboard_control, inspect_board_state",
    "Needs MathGPL open in a browser",
  ],
  ["Game / activity", "slate_* tools", "Partial"],
  ["Assignment", "assign_question (confirmation required)", "Partial"],
  ["Academia", "none", "Needs development"],
  [
    "Video study / tutorial export",
    "none",
    "Needs development and an extra service",
  ],
];
const CapabilityMap = () => (
  <div className={card}>
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th className="py-1">Step</th>
          <th>Assistant functions</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {CAPS.map(([a, b, c]) => (
          <tr key={a} className="border-t border-border">
            <td className="py-2 pr-2 font-medium">{a}</td>
            <td className="pr-2 font-mono text-xs">{b}</td>
            <td className="text-xs">{c}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default AssistantTrainingPage;
