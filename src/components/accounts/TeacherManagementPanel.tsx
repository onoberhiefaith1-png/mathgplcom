/**
 * Teacher management, shared by School and Parent accounts.
 *
 * School: owns the teachers it adds (own org, own workspace each).
 * Parent: connects existing teachers to the family — no org ownership.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, Plus, ShieldOff, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  fetchTeachers,
  inviteTeacher,
  createTeacher,
  setTeacherStatus,
  removeTeacher,
  fetchParentTeachers,
  connectParentTeacher,
  disconnectParentTeacher,
} from "@/lib/accounts/teachers.functions";

type Mode = "school" | "parent";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  invited: "bg-amber-500/15 text-amber-300",
  suspended: "bg-rose-500/15 text-rose-300",
};

const TeacherManagementPanel = ({ mode }: { mode: Mode }) => {
  const qc = useQueryClient();
  const loadSchool = useServerFn(fetchTeachers);
  const loadParent = useServerFn(fetchParentTeachers);
  const invite = useServerFn(inviteTeacher);
  const create = useServerFn(createTeacher);
  const status = useServerFn(setTeacherStatus);
  const remove = useServerFn(removeTeacher);
  const connect = useServerFn(connectParentTeacher);
  const disconnect = useServerFn(disconnectParentTeacher);

  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"invite" | "password">("invite");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const key = mode === "school" ? ["school-teachers"] : ["parent-teachers"];
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      mode === "school"
        ? (await loadSchool()).teachers
        : (await loadParent()).teachers.map((t) => ({
            userId: t.teacherId,
            linkId: t.linkId,
            name: t.name,
            email: t.email,
            status: t.status,
            childName: t.childName,
          })),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const addTeacher = useMutation({
    mutationFn: async () => {
      if (mode === "parent") {
        return connect({ data: { email: form.email.trim() } });
      }
      if (method === "invite") {
        return invite({
          data: {
            email: form.email.trim(),
            firstName: form.firstName.trim() || undefined,
            lastName: form.lastName.trim() || undefined,
            origin: window.location.origin,
          },
        });
      }
      return create({
        data: {
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: mode === "parent" ? "Teacher connected" : "Teacher added",
        description:
          mode === "school" && method === "invite"
            ? "An invitation email is on its way. They set their own password."
            : "The teacher can sign in now with their own separate workspace.",
      });
      setForm({ firstName: "", lastName: "", email: "", password: "" });
      setOpen(false);
      refresh();
    },
    onError: (e: Error) =>
      toast({ title: "Could not add teacher", description: e.message, variant: "destructive" }),
  });

  const act = useMutation({
    mutationFn: async (a: { kind: "suspend" | "activate" | "remove"; id: string; linkId?: string }) => {
      if (mode === "parent") return disconnect({ data: { linkId: a.linkId! } });
      if (a.kind === "remove") return remove({ data: { teacherId: a.id } });
      return status({
        data: { teacherId: a.id, status: a.kind === "suspend" ? "suspended" : "active" },
      });
    },
    onSuccess: () => refresh(),
    onError: (e: Error) =>
      toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const rows = (query.data ?? []) as Array<Record<string, unknown>>;

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Teachers</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "school"
              ? "Every teacher you add owns an independent workspace: their own classes, students, lesson notes and reports."
              : "Connect the teachers who teach your children. Each teacher keeps their own independent workspace."}
          </p>
        </div>
        <Button onClick={() => setOpen((v) => !v)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Teacher
        </Button>
      </div>

      {open && (
        <form
          className="mt-5 grid gap-3 rounded-xl border border-border bg-background/40 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            addTeacher.mutate();
          }}
        >
          {mode === "school" && (
            <div className="sm:col-span-2 flex gap-2">
              {(["invite", "password"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    method === m
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "invite" ? "Invite by email" : "Set a temporary password"}
                </button>
              ))}
            </div>
          )}

          {mode === "school" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} maxLength={60} />
              </div>
            </>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="teacherEmail">Teacher email</Label>
            <Input
              id="teacherEmail"
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              maxLength={255}
            />
          </div>

          {mode === "school" && method === "password" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tempPassword">Temporary password</Label>
              <Input
                id="tempPassword"
                type="text"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={addTeacher.isPending} className="gap-2">
              {addTeacher.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {mode === "parent" ? "Connect teacher" : method === "invite" ? "Send invitation" : "Create teacher"}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto">
        {query.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading teachers…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teachers yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Status</th>
                {mode === "school" ? (
                  <>
                    <th className="py-2 pr-4">Classes</th>
                    <th className="py-2 pr-4">Students</th>
                  </>
                ) : (
                  <th className="py-2 pr-4">Child</th>
                )}
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const id = String(t.userId);
                const st = String(t.status ?? "active");
                return (
                  <tr key={String(t.linkId ?? id)} className="border-t border-border/60">
                    <td className="py-2 pr-4 font-medium">{String(t.name)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {t.email ? (
                        <a className="inline-flex items-center gap-1 hover:text-foreground" href={`mailto:${t.email}`}>
                          <Mail className="h-3.5 w-3.5" /> {String(t.email)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[st] ?? "bg-muted text-muted-foreground"}`}>
                        {st}
                      </span>
                    </td>
                    {mode === "school" ? (
                      <>
                        <td className="py-2 pr-4">{String(t.classCount ?? 0)}</td>
                        <td className="py-2 pr-4">{String(t.studentCount ?? 0)}</td>
                      </>
                    ) : (
                      <td className="py-2 pr-4 text-muted-foreground">{t.childName ? String(t.childName) : "All children"}</td>
                    )}
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {mode === "school" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            disabled={act.isPending}
                            onClick={() => act.mutate({ kind: st === "suspended" ? "activate" : "suspend", id })}
                          >
                            {st === "suspended" ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                            {st === "suspended" ? "Reactivate" : "Suspend"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-destructive"
                          disabled={act.isPending}
                          onClick={() =>
                            act.mutate({ kind: "remove", id, linkId: t.linkId ? String(t.linkId) : undefined })
                          }
                        >
                          <Trash2 className="h-4 w-4" /> {mode === "parent" ? "Disconnect" : "Remove"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default TeacherManagementPanel;
