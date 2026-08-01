import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Eye,
  Loader2,
  Mail,
  RotateCcw,
  Save,
  Send,
} from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  fetchEmailConfig,
  saveEmailSender,
  saveEmailTemplate,
  sendTestEmail,
} from "@/lib/email/emailAdmin.functions";
import {
  CONNECTION_LABEL,
  PREVIEW_DATA,
  TEMPLATE_META,
  renderTemplate,
  type ConnectionState,
  type EmailTemplate,
  type TemplateKey,
} from "@/lib/email/templates";

type Tab = "sender" | "connection" | "test" | "templates";

const TABS: { key: Tab; label: string }[] = [
  { key: "sender", label: "Sender" },
  { key: "connection", label: "Connection" },
  { key: "test", label: "Send test email" },
  { key: "templates", label: "Templates" },
];

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

  useEffect(() => {
    if (!config.data) return;
    setSender({
      sender_name: config.data.sender.sender_name ?? "MathGPL",
      sender_email: config.data.sender.sender_email ?? "",
      reply_to_email: config.data.sender.reply_to_email ?? "",
    });
    setTemplates(config.data.templates as EmailTemplate[]);
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
                    <Input id="subject" value={active.subject} onChange={(e) => patchActive({ subject: e.target.value })} maxLength={200} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="body">Body</Label>
                    <Textarea id="body" rows={10} value={active.body} onChange={(e) => patchActive({ body: e.target.value })} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="footer">Footer</Label>
                      <Textarea id="footer" rows={3} value={active.footer} onChange={(e) => patchActive({ footer: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signature">Signature</Label>
                      <Textarea id="signature" rows={3} value={active.signature} onChange={(e) => patchActive({ signature: e.target.value })} />
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
                      <p className="mt-2 text-sm text-slate-500">
                        From: {sender.sender_name || "MathGPL"} &lt;{sender.sender_email || "default MathGPL sender"}&gt;
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-dash-navy">
                        {renderTemplate(active.subject, PREVIEW_DATA)}
                      </h3>
                      <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-slate-700">
                        {renderTemplate(active.body, PREVIEW_DATA)}
                      </pre>
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
