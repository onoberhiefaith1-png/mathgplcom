import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, KeyRound, Loader2, Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { customIdError } from "@/lib/accounts/customIdRules";
import { suggestStudentPassword } from "@/lib/accounts/studentRules";
import {
  createStudentAccount,
  fetchManagedStudents,
  removeStudentAccount,
  resetStudentPassword,
} from "@/lib/accounts/students.functions";

/**
 * Student accounts a school or teacher creates directly.
 *
 * The student needs no email: they receive the ID and password shown here and
 * sign in straight into this workspace.
 */
const ManagedStudentsPanel = ({ tone = "light" }: { tone?: "light" | "dark" }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const load = useServerFn(fetchManagedStudents);
  const create = useServerFn(createStudentAccount);
  const reset = useServerFn(resetStudentPassword);
  const remove = useServerFn(removeStudentAccount);

  const light = tone === "light";
  const card = light
    ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    : "rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-5";
  const heading = light ? "text-slate-900" : "";
  const body = light ? "text-slate-600" : "text-muted-foreground";
  const field = light ? "bg-white text-slate-900 placeholder:text-slate-400" : "";
  const row = light
    ? "rounded-xl border border-slate-200 bg-slate-50 p-4"
    : "rounded-xl border border-ws-border/60 bg-ws-canvas/40 p-4";

  const students = useQuery({
    queryKey: ["managed-students"],
    queryFn: () => load({}),
  });

  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState(suggestStudentPassword());
  const [created, setCreated] = useState<{ id: string; password: string } | null>(null);

  const idProblem = studentId.trim() ? customIdError(studentId) : null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["managed-students"] });

  const createMutation = useMutation({
    mutationFn: async () =>
      create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          customId: studentId.trim(),
          password,
        },
      }),
    onSuccess: (res) => {
      if (!res?.ok) {
        toast({ title: "Could not create the student", description: res?.message, variant: "destructive" });
        return;
      }
      setCreated({ id: studentId.trim(), password });
      setFirstName("");
      setLastName("");
      setStudentId("");
      setPassword(suggestStudentPassword());
      setOpen(false);
      void refresh();
      toast({ title: "Student account created", description: "Give the student their ID and password." });
    },
    onError: (e: Error) => toast({ title: "Could not create the student", description: e.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async (vars: { userId: string; password: string }) =>
      reset({ data: { studentId: vars.userId, password: vars.password } }),
    onSuccess: (_r, vars) =>
      toast({ title: "New password set", description: `Give the student: ${vars.password}` }),
    onError: (e: Error) => toast({ title: "Could not reset the password", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => remove({ data: { studentId: userId } }),
    onSuccess: () => {
      void refresh();
      toast({ title: "Student account removed" });
    },
    onError: (e: Error) => toast({ title: "Could not remove the account", description: e.message, variant: "destructive" }),
  });

  const list = students.data?.students ?? [];

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`flex items-center gap-2 text-base font-semibold ${heading}`}>
            <UserPlus className={`h-4 w-4 ${light ? "text-slate-500" : "text-ws-violet"}`} /> Student accounts you create
          </h2>
          <p className={`mt-1 text-sm ${body}`}>
            No email needed. Choose an ID and a password, hand them to the student, and they sign in here.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen((v) => !v)} className="min-h-[44px]">
          {open ? "Close" : "New student"}
        </Button>
      </div>

      {created ? (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-semibold">
            <Check className="h-4 w-4" /> Give the student these details
          </p>
          <p className="mt-2 font-mono">ID: {created.id}</p>
          <p className="font-mono">Password: {created.password}</p>
          <button type="button" onClick={() => setCreated(null)} className="mt-2 text-xs underline">
            Hide
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className={light ? "text-slate-700" : ""}>First name</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label className={light ? "text-slate-700" : ""}>Last name</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label className={light ? "text-slate-700" : ""}>Student ID</Label>
            <Input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. ade.year7.01"
              autoComplete="off"
              maxLength={32}
              className={field}
            />
            {idProblem ? <p className="text-xs text-red-600">{idProblem}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label className={light ? "text-slate-700" : ""}>Password</Label>
            <div className="flex gap-2">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128} className={field} />
              <Button type="button" variant="outline" onClick={() => setPassword(suggestStudentPassword())} className="min-h-[44px]">
                New
              </Button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button
              type="button"
              disabled={
                createMutation.isPending ||
                !firstName.trim() ||
                Boolean(idProblem) ||
                studentId.trim().length < 4 ||
                password.length < 8
              }
              onClick={() => createMutation.mutate()}
              className="min-h-[44px]"
            >
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Create student account
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {students.isLoading ? (
          <p className={`text-sm ${body}`}>Loading…</p>
        ) : list.length === 0 ? (
          <p className={`text-sm ${body}`}>No student accounts created here yet.</p>
        ) : (
          list.map((student) => (
            <div key={student.userId} className={`${row} flex flex-wrap items-center justify-between gap-3`}>
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium ${heading}`}>{student.name}</p>
                <p className={`truncate font-mono text-[11px] ${body}`}>{student.studentId ?? student.issuedId ?? "—"}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[40px]"
                  disabled={resetMutation.isPending}
                  onClick={() => {
                    const next = suggestStudentPassword();
                    resetMutation.mutate({ userId: student.userId, password: next });
                  }}
                >
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" /> New password
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[40px]"
                  disabled={removeMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove ${student.name}'s account? This cannot be undone.`)) {
                      removeMutation.mutate(student.userId);
                    }
                  }}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default ManagedStudentsPanel;
