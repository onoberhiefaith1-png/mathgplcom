/**
 * Authoring catalog inside the Academia app. Uses the same AcademiaItemMenu
 * and canManageAcademiaItem rules as /school/academia and /academia, so a
 * published UI change reaches the installed app on /academia-app after the
 * app shell is updated.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAccount } from "@/lib/accounts/useAccount";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useAcademiaDrillTrail } from "@/hooks/useAcademiaDrillTrail";
import { Column } from "@/pages/academia/SchoolAcademiaPage";
import { AcademiaCatalogRowMenu } from "@/components/academia/AcademiaCatalogRowMenu";
import {
  academiaForWorkspace,
  addClass,
  addSession,
  addSubject,
  addSubtopic,
  addTopic,
  ensureSchoolAcademia,
  isAcademiaOrgOwner,
  loadAcademiaTree,
  mySubjectIds,
} from "@/lib/academia/api";

export default function AcademiaAppCatalog() {
  const { user, ready } = useAuth();
  const { role, orgId, isLoading: accountLoading } = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  if (!ready || (user && accountLoading)) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Opening your Academia…
      </div>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">Build Academia</h1>
        <p className="text-sm text-muted-foreground">
          Sign in with your school or teacher account to rename, duplicate or delete catalog items.
          School accounts can manage everyone&apos;s work. Teachers can manage only the topics, subtopics and sessions they created.
        </p>
        {notice && <p role="status" className="rounded-xl border border-border p-3 text-sm">{notice}</p>}
        <form
          className="space-y-3 rounded-2xl border border-border bg-card p-4"
          onSubmit={event => {
            event.preventDefault();
            setBusy(true);
            setNotice("");
            void supabase.auth.signInWithPassword({ email: email.trim(), password }).then(({ error }) => {
              setBusy(false);
              if (error) setNotice(error.message);
            });
          }}
        >
          <label className="block text-sm">Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" /></label>
          <label className="block text-sm">Password<input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" /></label>
          <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Please wait…" : "Sign in"}</button>
        </form>
      </section>
    );
  }

  if (role === "school" && orgId) return <SchoolCatalog orgId={orgId} />;
  return <TeacherCatalog />;
}

function SchoolCatalog({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const academiaQ = useQuery({ queryKey: ["academia", orgId], queryFn: () => ensureSchoolAcademia(orgId) });
  const academia = academiaQ.data;
  const treeQ = useQuery({
    queryKey: ["academia-tree", academia?.id],
    enabled: !!academia,
    queryFn: () => loadAcademiaTree(academia!.id),
  });
  const tree = treeQ.data;
  const drill = useAcademiaDrillTrail({
    active: !!academia,
    academiaId: academia?.id ?? null,
    catalogReady: treeQ.isSuccess && !!academia,
    syncUrl: false,
    classes: tree?.classes ?? [],
    subjects: tree?.subjects ?? [],
    topics: tree?.topics ?? [],
    subtopics: tree?.subtopics ?? [],
  });
  const run = async (fn: () => Promise<unknown>, key: unknown[]) => {
    try { await fn(); await qc.invalidateQueries({ queryKey: key }); }
    catch (e) { toast.error((e as Error).message || "That didn't save."); }
  };
  if (academiaQ.isLoading || treeQ.isLoading) {
    return <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening your Academia…</div>;
  }
  if (!academia) return <p className="text-sm text-muted-foreground">Your Academia could not be opened.</p>;
  const classes = tree?.classes ?? [];
  const subjects = (tree?.subjects ?? []).filter(s => s.class_id === drill.classId);
  const topics = (tree?.topics ?? []).filter(t => t.subject_id === drill.subjectId);
  const subtopics = (tree?.subtopics ?? []).filter(s => s.topic_id === drill.topicId);
  const treeKey = ["academia-tree", academia.id];
  return (
    <CatalogBoard
      heading="School Academia"
      note="You can duplicate, rename or delete every item in this school."
      isOrgOwner
      classes={classes}
      subjects={subjects}
      topics={topics}
      subtopics={subtopics}
      sessions={drill.sessions}
      drill={drill}
      onOpenSession={id => { drill.selectSession(id); navigate(`/academia/session/${id}`); }}
      onAddClass={name => run(() => addClass(academia.id, name, classes.length), treeKey)}
      onAddSubject={drill.classId ? name => run(() => addSubject(drill.classId!, name, subjects.length), treeKey) : undefined}
      onAddTopic={drill.subjectId ? name => run(() => addTopic(drill.subjectId!, name, topics.length), treeKey) : undefined}
      onAddSubtopic={drill.topicId ? name => run(() => addSubtopic(drill.topicId!, name, subtopics.length), treeKey) : undefined}
      onAddSession={drill.subtopicId ? name => run(async () => {
        const id = await addSession(drill.subtopicId!, name, drill.sessions.length);
        drill.selectSession(id);
        navigate(`/academia/session/${id}`);
      }, ["academia-sessions", drill.subtopicId]) : undefined}
    />
  );
}

function TeacherCatalog() {
  const { user } = useAuth();
  const { active, activeOrgId, isLoading } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const shared = active?.kind === "school";
  const academiaQ = useQuery({
    queryKey: ["academia-org", activeOrgId],
    enabled: !!activeOrgId && shared,
    queryFn: () => academiaForWorkspace(activeOrgId!, false),
  });
  const academia = academiaQ.data;
  const ownerQ = useQuery({
    queryKey: ["academia-org-owner", academia?.org_id],
    enabled: !!academia?.org_id,
    queryFn: () => isAcademiaOrgOwner(academia!.org_id),
  });
  const isOrgOwner = ownerQ.data === true;
  const treeQ = useQuery({
    queryKey: ["academia-tree", academia?.id],
    enabled: !!academia,
    queryFn: () => loadAcademiaTree(academia!.id),
  });
  const mineQ = useQuery({ queryKey: ["academia-mine"], queryFn: () => mySubjectIds() });
  const tree = treeQ.data;
  const mine = useMemo(() => new Set(mineQ.data ?? []), [mineQ.data]);
  const drill = useAcademiaDrillTrail({
    active: shared && !!academia,
    academiaId: academia?.id ?? null,
    catalogReady: shared && treeQ.isSuccess && mineQ.isSuccess && !!academia,
    syncUrl: false,
    classes: tree?.classes ?? [],
    subjects: (tree?.subjects ?? []).filter(s => mine.has(s.id)),
    topics: tree?.topics ?? [],
    subtopics: tree?.subtopics ?? [],
  });
  const run = async (fn: () => Promise<unknown>, key: unknown[]) => {
    try { await fn(); await qc.invalidateQueries({ queryKey: key }); }
    catch (e) { toast.error((e as Error).message || "That didn't save."); }
  };
  if (isLoading || academiaQ.isLoading) {
    return <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening Academia…</div>;
  }
  if (!shared || !academia) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Sign in with a school or teacher account that belongs to a school Academia to build the catalog here.
      </p>
    );
  }
  const classes = tree?.classes ?? [];
  const subjects = (tree?.subjects ?? []).filter(s => s.class_id === drill.classId && mine.has(s.id));
  const topics = (tree?.topics ?? []).filter(t => t.subject_id === drill.subjectId);
  const subtopics = (tree?.subtopics ?? []).filter(s => s.topic_id === drill.topicId);
  const treeKey = ["academia-tree", academia.id];
  return (
    <CatalogBoard
      heading="My Academia"
      note="The ⋯ menu appears only on topics, subtopics and sessions you created. Classes and subjects stay school-only."
      userId={user?.id}
      isOrgOwner={isOrgOwner}
      classes={classes}
      subjects={subjects}
      topics={topics}
      subtopics={subtopics}
      sessions={drill.sessions}
      drill={drill}
      onOpenSession={id => { drill.selectSession(id); navigate(`/academia/session/${id}`); }}
      onAddTopic={drill.subjectId ? name => run(() => addTopic(drill.subjectId!, name, topics.length), treeKey) : undefined}
      onAddSubtopic={drill.topicId ? name => run(() => addSubtopic(drill.topicId!, name, subtopics.length), treeKey) : undefined}
      onAddSession={drill.subtopicId ? name => run(async () => {
        const id = await addSession(drill.subtopicId!, name, drill.sessions.length);
        drill.selectSession(id);
        navigate(`/academia/session/${id}`);
      }, ["academia-sessions", drill.subtopicId]) : undefined}
    />
  );
}

type BoardItem = { id: string; name?: string; title?: string; created_by?: string | null };

export function CatalogBoard({
  heading,
  note,
  userId,
  isOrgOwner,
  classes,
  subjects,
  topics,
  subtopics,
  sessions,
  drill,
  onOpenSession,
  onAddClass,
  onAddSubject,
  onAddTopic,
  onAddSubtopic,
  onAddSession,
}: {
  heading: string;
  note: string;
  userId?: string | null;
  isOrgOwner: boolean;
  classes: BoardItem[];
  subjects: BoardItem[];
  topics: BoardItem[];
  subtopics: BoardItem[];
  sessions: { id: string; title: string; created_by?: string | null }[];
  drill: {
    classId: string | null; subjectId: string | null; topicId: string | null; subtopicId: string | null; sessionId: string | null;
    selectClass: (id: string) => void; selectSubject: (id: string) => void; selectTopic: (id: string) => void; selectSubtopic: (id: string) => void;
  };
  onOpenSession: (id: string) => void;
  onAddClass?: (name: string) => void;
  onAddSubject?: (name: string) => void;
  onAddTopic?: (name: string) => void;
  onAddSubtopic?: (name: string) => void;
  onAddSession?: (name: string) => void;
}) {
  const named = (items: BoardItem[], fallback: string) => items.map(item => ({ id: item.id, name: item.name ?? fallback, created_by: item.created_by }));
  return (
    <div data-academia-app-catalog>
      <h1 className="text-2xl font-bold">{heading}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{note}</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Column title="Classes" items={named(classes, "Class")} selected={drill.classId} onSelect={drill.selectClass} onAdd={onAddClass} addLabel="New class"
          empty="No classes yet." menu={id => <AcademiaCatalogRowMenu kind="class" item={classes.find(item => item.id === id) ?? { id, name: "Class" }} userId={userId} isOrgOwner={isOrgOwner} />} />
        <Column title="Subjects" items={named(subjects, "Subject")} selected={drill.subjectId} onSelect={drill.selectSubject} onAdd={onAddSubject} addLabel="New subject"
          empty={drill.classId ? "No subjects in this class." : "Choose a class first."}
          menu={id => <AcademiaCatalogRowMenu kind="subject" item={subjects.find(item => item.id === id) ?? { id, name: "Subject" }} userId={userId} isOrgOwner={isOrgOwner} />} />
        <Column title="Topics" items={named(topics, "Topic")} selected={drill.topicId} onSelect={drill.selectTopic} onAdd={onAddTopic} addLabel="New topic"
          empty={drill.subjectId ? "No topics yet." : "Choose a subject first."}
          menu={id => <AcademiaCatalogRowMenu kind="topic" item={topics.find(item => item.id === id) ?? { id, name: "Topic" }} userId={userId} isOrgOwner={isOrgOwner} />} />
        <Column title="Subtopics" items={named(subtopics, "Subtopic")} selected={drill.subtopicId} onSelect={drill.selectSubtopic} onAdd={onAddSubtopic} addLabel="New subtopic"
          empty={drill.topicId ? "No subtopics yet." : "Choose a topic first."}
          menu={id => <AcademiaCatalogRowMenu kind="subtopic" item={subtopics.find(item => item.id === id) ?? { id, name: "Subtopic" }} userId={userId} isOrgOwner={isOrgOwner} />} />
        <Column title="Sessions" items={sessions.map((s, i) => ({ id: s.id, name: `${i + 1}. ${s.title}` }))} selected={drill.sessionId} onSelect={onOpenSession} onAdd={onAddSession} addLabel="New session"
          empty={drill.subtopicId ? "No sessions yet." : "Choose a subtopic first."}
          menu={id => <AcademiaCatalogRowMenu kind="session" item={sessions.find(item => item.id === id) ?? { id, title: "Session" }} userId={userId} isOrgOwner={isOrgOwner} />} />
      </div>
    </div>
  );
}
