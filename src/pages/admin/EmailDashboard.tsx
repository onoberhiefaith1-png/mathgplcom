import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  activateSavedSender,
  addSavedSender,
  fetchEmailActivity,
  fetchEmailConfig,
  fetchSavedSenders,
  removeSavedSender,
  saveEmailSender,
  saveEmailTemplate,
  sendTestEmail,
} from "@/lib/email/emailAdmin.functions";
import {
  ACTIVITY_RANGES,
  CONNECTION_LABEL,
  PREVIEW_DATA,
  TEMPLATE_META,
  renderTemplate,
  type ActivityRangeKey,
  type ConnectionState,
  type EmailTemplate,
  type TemplateKey,
} from "@/lib/email/templates";

type Tab = "sender" | "templates" | "activity" | "connection" | "test";

const TABS: { key: Tab; label: string }[] = [
  { key: "sender", label: "Sender" },
  { key: "templates", label: "Templates" },
  { key: "activity", label: "Activity" },
  { key: "connection", label: "Connection" },
  { key: "test", label: "Send test email" },
];

const FIELD = "bg-white text-slate-900 placeholder:text-slate-400";

const STATUS_TONE: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  suppressed: "bg-amber-50 text-amber-700 border-amber-200",
  dlq: "bg-rose-50 text-rose-700 border-rose-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  bounced: "bg-rose-50 text-rose-700 border-rose-200",
  complained: "bg-rose-50 text-rose-700 border-rose-200",
};

const Card = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_10px_30px_rgba(9,16,40,0.12)]">
    <h2 className="text-base font-semibold text-dash-navy">{title}</h2>
    {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const stateTone: Record<ConnectionState, string> = {
  connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  awaiting_dns: "bg-amber-50 text-amber-700 border-amber-200",
  not_connected: "bg-slate-100 text-slate-600 border-slate-200",
  auth_failed: "bg-rose-50 text-rose-700 border-rose-200",
  invalid_credentials: "bg-rose-50 text-rose-700 border-rose-200",
  limit_reached: "bg-amber-50 text-amber-700 border-amber-200",
};

/**
 * Settings → System Settings → Email Dashboard.
 *
 * Configures how MathGPL sends every email: verification, password reset,
 * invitations and notifications. Changing the sender address here changes it
 * everywhere — no other part of the application stores an email address.
 */
const EmailDashboard = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("sender");

  const config = useQuery({ queryKey: ["email-config"], queryFn: () => fetchEmailConfig() });

  const [sender, setSender] = useState({ sender_name: "", sender_email: "", reply_to_email: "" });
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [activeKey, setActiveKey] = useState<TemplateKey>("email_verification");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [range, setRange] = useState<ActivityRangeKey>("7d");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [newSender, setNewSender] = useState({ sender_name: "", sender_email: "", reply_to_email: "" });

  const rangeWindow = useMemo(() => {
    const hours = ACTIVITY_RANGES.find((r) => r.key === range)?.hours ?? 168;
    const until = new Date();
    const since = new Date(until.getTime() - hours * 3600_000);
    return { since: since.toISOString(), until: until.toISOString() };
  }, [range]);

  const senders = useQuery({ queryKey: ["email-senders"], queryFn: () => fetchSavedSenders() });
  const activity = useQuery({
    queryKey: ["email-activity", rangeWindow.since, rangeWindow.until],
    queryFn: () => fetchEmailActivity({ data: rangeWindow }),
  });

  const refreshSenders = () => {
    qc.invalidateQueries({ queryKey: ["email-senders"] });
    qc.invalidateQueries({ queryKey: ["email-config"] });
  };

  const addSender = useMutation({
    mutationFn: () => addSavedSender({ data: newSender }),
    onSuccess: () => {
      setNewSender({ sender_name: "", sender_email: "", reply_to_email: "" });
      toast({ title: "Sender saved to your list" });
      refreshSenders();
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const useSender = useMutation({
    mutationFn: (id: string) => activateSavedSender({ data: { id } }),
    onSuccess: () => {
      toast({ title: "Sender switched", description: "Every MathGPL email now comes from this address." });
      refreshSenders();
    },
    onError: (e: Error) => toast({ title: "Could not switch", description: e.message, variant: "destructive" }),
  });

  const dropSender = useMutation({
    mutationFn: (id: string) => removeSavedSender({ data: { id } }),
    onSuccess: () => {
      toast({ title: "Sender removed" });
      refreshSenders();
    },
    onError: (e: Error) => toast({ title: "Could not remove", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!config.data) return;
    setSender({
      sender_name: config.data.sender.sender_name ?? "MathGPL",
      sender_email: config.data.sender.sender_email ?? "",
      reply_to_email: config.data.sender.reply_to_email ?? "",
    });
    setTemplates(config.data.templates as unknown as EmailTemplate[]);
  }, [config.data]);

  const active = useMemo(
    () => templates.find((t) => t.template_key === activeKey) ?? null,
    [templates, activeKey],
  );
  const meta = TEMPLATE_META.find((m) => m.key === activeKey);

  const patchActive = (patch: Partial<EmailTemplate>) =>
    setTemplates((prev) => prev.map((t) => (t.template_key === activeKey ? { ...t, ...patch } : t)));

  const senderMutation = useMutation({
    mutationFn: () => saveEmailSender({ data: { ...sender, notes: "" } }),
    onSuccess: () => {
      toast({ title: "Sender saved", description: "Every MathGPL email now uses this identity." });
      qc.invalidateQueries({ queryKey: ["email-config"] });
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const templateMutation = useMutation({
    mutationFn: () =>
      saveEmailTemplate({
        data: {
          template_key: activeKey,
          subject: active?.subject ?? "",
          body: active?.body ?? "",
          footer: active?.footer ?? "",
          signature: active?.signature ?? "",
          heading_color: active?.heading_color || "#0f172a",
          text_color: active?.text_color || "#334155",
          button_color: active?.button_color || "#f59e0b",
          button_label: active?.button_label || "Continue",
          logo_text: active?.logo_text ?? "MathGPL",
        },
      }),
    onSuccess: () => {
      toast({ title: "Template saved" });
      qc.invalidateQueries({ queryKey: ["email-config"] });
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      sendTestEmail({ data: { to: testTo, template_key: activeKey, origin: window.location.origin } }),
    onSuccess: (res) =>
      toast({
        title: res.ok ? "Test email sent" : "Test email not sent",
        description: res.message,
        variant: res.ok ? undefined : "destructive",
      }),
    onError: (e: Error) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  const connection = config.data?.connection;

  if (config.isLoading) {
    return (
      <DashboardShell title="Email Dashboard">
        <div className="flex items-center gap-2 text-dash-surface/80">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading email configuration…
        </div>
      </DashboardShell>
    );
  }

  if (config.error) {
    return (
      <DashboardShell title="Email Dashboard">
        <Card title="Not available">
          <p className="text-sm text-slate-600">{(config.error as Error).message}</p>
        </Card>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Email Dashboard"
      subtitle="Everything MathGPL sends — verification, password resets, invitations and notifications — uses the configuration on this page."
    >
      <div className="mx-auto w-full max-w-7xl pb-16">
        <div className="mb-5 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`min-h-[40px] rounded-full px-4 text-sm font-medium transition ${
                tab === t.key
                  ? "bg-dash-gold text-dash-navy"
                  : "border border-dash-surface/25 bg-dash-surface/10 text-dash-surface hover:bg-dash-surface/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "sender" && (
          <Card
            title="Email sender"
            description="The name and address recipients see. Start with any address you control and switch to your professional address later — nothing else in the app changes."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sender_name">Sender name</Label>
                <Input
                  id="sender_name"
                  value={sender.sender_name}
                  onChange={(e) => setSender((p) => ({ ...p, sender_name: e.target.value }))}
                  placeholder="MathGPL"
                  className={FIELD}
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sender_email">Sender email</Label>
                <Input
                  id="sender_email"
                  type="email"
                  value={sender.sender_email}
                  onChange={(e) => setSender((p) => ({ ...p, sender_email: e.target.value }))}
                  placeholder="accounts@mathgpl.com"
                  className={FIELD}
                  maxLength={255}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="reply_to">Reply-to email</Label>
                <Input
                  id="reply_to"
                  type="email"
                  value={sender.reply_to_email}
                  onChange={(e) => setSender((p) => ({ ...p, reply_to_email: e.target.value }))}
                  placeholder="support@mathgpl.com"
                  className={FIELD}
                  maxLength={255}
                />
              </div>
            </div>
            <Button className="mt-4" onClick={() => senderMutation.mutate()} disabled={senderMutation.isPending}>
              {senderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save sender
            </Button>
          </Card>
        )}

        {tab === "sender" && (
          <div className="mt-5">
            <Card
              title="Saved sender addresses"
              description="Keep every address you send from here. Switching makes that address the live sender for the whole platform straight away."
            >
              <div className="grid gap-2">
                {(senders.data ?? []).length === 0 && (
                  <p className="text-sm text-slate-500">No saved addresses yet — add one below.</p>
                )}
                {(senders.data ?? []).map((sv) => {
                  const live = sv.sender_email === sender.sender_email;
                  return (
                    <div
                      key={sv.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-dash-navy">{sv.sender_name}</p>
                        <p className="truncate text-xs text-slate-500">{sv.sender_email}</p>
                      </div>
                      {live ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> In use
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => useSender.mutate(sv.id)} disabled={useSender.isPending}>
                          Use this address
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${sv.sender_email}`}
                        className="min-h-11 min-w-11 text-slate-500 hover:text-rose-600"
                        onClick={() => dropSender.mutate(sv.id)}
                        disabled={dropSender.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new_sender_name">Name</Label>
                  <Input
                    id="new_sender_name"
                    className={FIELD}
                    value={newSender.sender_name}
                    onChange={(e) => setNewSender((p) => ({ ...p, sender_name: e.target.value }))}
                    placeholder="MathGPL"
                    maxLength={80}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new_sender_email">Email</Label>
                  <Input
                    id="new_sender_email"
                    type="email"
                    className={FIELD}
                    value={newSender.sender_email}
                    onChange={(e) => setNewSender((p) => ({ ...p, sender_email: e.target.value }))}
                    placeholder="you@gmail.com"
                    maxLength={255}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new_sender_reply">Reply-to (optional)</Label>
                  <Input
                    id="new_sender_reply"
                    type="email"
                    className={FIELD}
                    value={newSender.reply_to_email}
                    onChange={(e) => setNewSender((p) => ({ ...p, reply_to_email: e.target.value }))}
                    maxLength={255}
                  />
                </div>
              </div>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => addSender.mutate()}
                disabled={addSender.isPending || !newSender.sender_name || !newSender.sender_email}
              >
                {addSender.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add address
              </Button>
            </Card>
          </div>
        )}

        {tab === "activity" && (
          <div className="grid gap-5">
            <Card title="Emails sent" description="Every message the platform has sent, counted once each.">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_RANGES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRange(r.key)}
                      className={`min-h-[40px] rounded-full px-4 text-sm font-medium transition ${
                        range === r.key
                          ? "bg-dash-navy text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="activity_template">Template</Label>
                  <select
                    id="activity_template"
                    value={templateFilter}
                    onChange={(e) => setTemplateFilter(e.target.value)}
                    className="h-10 w-full min-w-[10rem] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="all">All templates</option>
                    {(activity.data?.templates ?? []).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="activity_status">Status</Label>
                  <select
                    id="activity_status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 w-full min-w-[9rem] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="all">All statuses</option>
                    <option value="sent">Sent</option>
                    <option value="pending">Queued</option>
                    <option value="failed">Failed</option>
                    <option value="suppressed">Suppressed</option>
                  </select>
                </div>
              </div>

              {activity.isLoading ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading delivery history…
                </p>
              ) : !activity.data?.available ? (
                <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  Delivery history becomes available once a sending domain is attached. Until then account
                  emails go out from the default MathGPL sender and are not logged here.
                </p>
              ) : (
                <>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-4">
                    {([
                      ["Total emails", activity.data.totals.total],
                      ["Sent", activity.data.totals.sent],
                      ["Failed", activity.data.totals.failed],
                      ["Suppressed", activity.data.totals.suppressed],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 p-3">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
                        <dd className="text-2xl font-semibold text-dash-navy">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[42rem] text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-slate-500">
                          <th className="py-2 pr-3">Template</th>
                          <th className="py-2 pr-3">Recipient</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activity.data.rows
                          .filter((r) => templateFilter === "all" || r.template_name === templateFilter)
                          .filter((r) =>
                            statusFilter === "all"
                              ? true
                              : statusFilter === "failed"
                                ? ["failed", "dlq", "bounced", "complained"].includes(r.status)
                                : r.status === statusFilter,
                          )
                          .slice(0, 50)
                          .map((r) => (
                            <tr key={r.message_id} className="border-t border-slate-100 align-top">
                              <td className="py-2 pr-3 text-slate-700">{r.template_name}</td>
                              <td className="py-2 pr-3 text-slate-700">{r.recipient_email}</td>
                              <td className="py-2 pr-3">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                    STATUS_TONE[r.status] ?? "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  {r.status}
                                </span>
                                {r.error_message && (
                                  <p className="mt-1 max-w-xs text-xs text-rose-600">{r.error_message}</p>
                                )}
                              </td>
                              <td className="py-2 pr-3 text-slate-500">
                                {new Date(r.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {activity.data.rows.length === 0 && (
                      <p className="mt-3 text-sm text-slate-500">No emails in this period.</p>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {tab === "connection" && connection && (
          <Card title="Connection" description="Live delivery status for the platform mail service.">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${stateTone[connection.state]}`}>
              {connection.state === "connected" ? <BadgeCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {CONNECTION_LABEL[connection.state]}
            </div>
            <p className="mt-3 text-sm text-slate-600">{connection.detail}</p>
            {connection.lastError && (
              <p className="mt-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{connection.lastError}</p>
            )}
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Recent successful sends</dt>
                <dd className="text-lg font-semibold text-dash-navy">{connection.recentSends}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Sending domain</dt>
                <dd className="text-sm font-medium text-dash-navy">
                  {connection.infrastructure ? "Attached" : "Not attached yet"}
                </dd>
              </div>
            </dl>
            {!connection.infrastructure && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                Account emails (verification and password reset) are already sending from the default MathGPL
                sender. To send from your own address, attach a domain you own — then this panel switches to
                Connected and every template uses your address.
              </p>
            )}
          </Card>
        )}

        {tab === "test" && (
          <Card
            title="Send test email"
            description="Sends the currently selected template to any address so you can confirm the configuration."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="test_to">Recipient</Label>
                <Input
                  id="test_to"
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="you@example.com"
                  className={FIELD}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="test_template">Template</Label>
                <select
                  id="test_template"
                  value={activeKey}
                  onChange={(e) => setActiveKey(e.target.value as TemplateKey)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                >
                  {TEMPLATE_META.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !testTo}
            >
              {testMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send test email
            </Button>
          </Card>
        )}

        {tab === "templates" && (
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <Card title="Templates">
              <div className="grid gap-1.5">
                {TEMPLATE_META.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setActiveKey(m.key)}
                    className={`min-h-[40px] rounded-lg px-3 text-left text-sm transition ${
                      activeKey === m.key ? "bg-dash-navy text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Card>

            <Card title={meta?.label ?? "Template"} description={meta?.purpose}>
              {active ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">
                    Placeholders: {(meta?.placeholders ?? []).map((p) => `{{${p}}}`).join("  ")}
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="subject">Subject</Label>
                    <Input id="subject" className={FIELD} value={active.subject} onChange={(e) => patchActive({ subject: e.target.value })} maxLength={200} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="body">Body</Label>
                    <Textarea id="body" className={FIELD} rows={10} value={active.body} onChange={(e) => patchActive({ body: e.target.value })} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="footer">Footer</Label>
                      <Textarea id="footer" className={FIELD} rows={3} value={active.footer} onChange={(e) => patchActive({ footer: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signature">Signature</Label>
                      <Textarea id="signature" className={FIELD} rows={3} value={active.signature} onChange={(e) => patchActive({ signature: e.target.value })} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-dash-navy">Look and colours</p>
                    <p className="mt-1 text-xs text-slate-500">
                      These control how this email looks in the recipient's inbox.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {([
                        ["heading_color", "Heading colour"],
                        ["text_color", "Text colour"],
                        ["button_color", "Button colour"],
                      ] as const).map(([key, label]) => (
                        <div key={key} className="space-y-1.5">
                          <Label htmlFor={key}>{label}</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              aria-label={label}
                              value={(active[key] as string) || "#000000"}
                              onChange={(e) => patchActive({ [key]: e.target.value } as Partial<EmailTemplate>)}
                              className="h-10 w-12 cursor-pointer rounded-md border border-slate-300 bg-white"
                            />
                            <Input
                              id={key}
                              className={FIELD}
                              value={(active[key] as string) ?? ""}
                              onChange={(e) => patchActive({ [key]: e.target.value } as Partial<EmailTemplate>)}
                              maxLength={9}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="space-y-1.5">
                        <Label htmlFor="button_label">Button label</Label>
                        <Input
                          id="button_label"
                          className={FIELD}
                          value={active.button_label ?? ""}
                          onChange={(e) => patchActive({ button_label: e.target.value })}
                          maxLength={60}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="logo_text">Heading / logo line</Label>
                        <Input
                          id="logo_text"
                          className={FIELD}
                          value={active.logo_text ?? ""}
                          onChange={(e) => patchActive({ logo_text: e.target.value })}
                          maxLength={60}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => templateMutation.mutate()} disabled={templateMutation.isPending}>
                      {templateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save template
                    </Button>
                    <Button variant="outline" onClick={() => setPreviewOpen((v) => !v)}>
                      <Eye className="mr-2 h-4 w-4" /> {previewOpen ? "Hide preview" : "Preview email"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const original = (config.data?.templates as EmailTemplate[] | undefined)?.find(
                          (t) => t.template_key === activeKey,
                        );
                        if (original) patchActive(original);
                      }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Discard changes
                    </Button>
                  </div>

                  {previewOpen && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Preview</p>
                      <p className="mt-2 text-sm font-semibold" style={{ color: active.heading_color }}>
                        {active.logo_text}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        From: {sender.sender_name || "MathGPL"} &lt;{sender.sender_email || "default MathGPL sender"}&gt;
                      </p>
                      <h3 className="mt-1 text-lg font-semibold" style={{ color: active.heading_color }}>
                        {renderTemplate(active.subject, PREVIEW_DATA)}
                      </h3>
                      <pre className="mt-3 whitespace-pre-wrap font-sans text-sm" style={{ color: active.text_color }}>
                        {renderTemplate(active.body, PREVIEW_DATA)}
                      </pre>
                      <span
                        className="mt-4 inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
                        style={{ backgroundColor: active.button_color }}
                      >
                        {active.button_label}
                      </span>
                      <p className="mt-4 text-sm text-slate-700">{renderTemplate(active.signature, PREVIEW_DATA)}</p>
                      <hr className="my-4 border-slate-200" />
                      <p className="text-xs text-slate-400">{renderTemplate(active.footer, PREVIEW_DATA)}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Mail className="h-4 w-4" /> Template not found.
                </p>
              )}
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  );
};

export default EmailDashboard;
