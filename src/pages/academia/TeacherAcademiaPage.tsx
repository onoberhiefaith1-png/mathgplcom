/**
 * Teacher Academia (Shared Workspace): School Classes read-only, only the
 * teacher's assigned Subjects, and Add Topic / Subtopic / Session.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, Loader2 } from "lucide-react";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import AcademiaHeader from "@/components/academia/AcademiaHeader";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { Column } from "./SchoolAcademiaPage";
import {
  academiaForWorkspace,
  addClass,
  addSubject,
  removeRow,
  addSession,
  addSubtopic,
  addTopic,
  deleteFrom,
  loadAcademiaTree,
  loadSessions,
  mySubjectIds,
} from "@/lib/academia/api";

const TeacherAcademiaPage = () => {
  const { active, activeOrgId, isLoading } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [classId, setClassId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [subtopicId, setSubtopicId] = useState<string | null>(null);

  const shared = active?.kind === "school";
  // Personal workspace → the teacher's own Academia; Shared → that school's.
  const personal = !shared && Boolean(active?.isOwner);
  const academiaQ = useQuery({
    queryKey: ["academia-org", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => academiaForWorkspace(activeOrgId!, personal),
  });
  const academia = academiaQ.data;
  const treeQ = useQuery({
    queryKey: ["academia-tree", academia?.id],
    enabled: !!academia,
    queryFn: () => loadAcademiaTree(academia!.id),
  });
  const mineQ = useQuery({ queryKey: ["academia-mine"], queryFn: mySubjectIds });
  const sessionsQ = useQuery({
    queryKey: ["academia-sessions", subtopicId],
    enabled: !!subtopicId,
    queryFn: () => loadSessions(subtopicId!),
  });

  const run = async (fn: () => Promise<unknown>, key: unknown[]) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error((e as Error).message || "That didn't save.");
    }
  };

  const shell = (body: React.ReactNode) => (
    <WorkspaceLayout title="Academia" collapsibleNav>
      <div className="mx-auto w-full max-w-7xl px-2 py-4">
        <Link to="/teaching-hub" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Teaching Hub
        </Link>
        {body}
      </div>
    </WorkspaceLayout>
  );

  if (isLoading || academiaQ.isLoading) {
    return shell(
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Opening Academia…
      </div>,
    );
  }
  if (!academia) {
    return shell(
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {shared ? `${active?.name} hasn't opened its Academia yet.` : "Your Academia could not be opened."}
      </p>,
    );
  }

  const tree = treeQ.data;
  const mine = new Set(mineQ.data ?? []);
  const classes = tree?.classes ?? [];
  const subjects = (tree?.subjects ?? []).filter((s) => s.class_id === classId && (personal || mine.has(s.id)));
  const topics = (tree?.topics ?? []).filter((t) => t.subject_id === subjectId);
  const subtopics = (tree?.subtopics ?? []).filter((s) => s.topic_id === topicId);
  const sessions = sessionsQ.data ?? [];
  const treeKey = ["academia-tree", academia.id];

  return shell(
    <>
      <AcademiaHeader
        academia={academia}
        ownerName={shared ? active?.name ?? academia.name : "My Academia"}
        canEdit={personal}
        queryKey={["academia-org", activeOrgId]}
      />
      <p className="mb-5 text-sm text-muted-foreground">
        {personal ? "Your personal Academia — build every level yourself." : "You can build inside the Subjects the school assigned to you."}
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Column
          title="Classes"
          items={classes}
          selected={classId}
          onSelect={(id) => { setClassId(id); setSubjectId(null); setTopicId(null); setSubtopicId(null); }}
          onAdd={personal ? (name) => run(() => addClass(academia.id, name, classes.length), treeKey) : undefined}
          onRemove={personal ? (id) => run(() => removeRow("academia_classes", id), treeKey) : undefined}
          addLabel="New class"
          empty={personal ? "Add your first Class." : "The school hasn't added Classes yet."}
        />
        <Column
          title={personal ? "Subjects" : "My Subjects"}
          items={subjects}
          onAdd={personal && classId ? (name) => run(() => addSubject(classId, name, subjects.length), treeKey) : undefined}
          onRemove={personal ? (id) => run(() => removeRow("academia_subjects", id), treeKey) : undefined}
          addLabel="New subject"
          selected={subjectId}
          onSelect={(id) => { setSubjectId(id); setTopicId(null); setSubtopicId(null); }}
          empty={classId ? "No Subjects in this Class are assigned to you." : "Choose a Class first."}
        />
        <Column
          title="Topics"
          items={topics}
          selected={topicId}
          onSelect={(id) => { setTopicId(id); setSubtopicId(null); }}
          onAdd={subjectId ? (name) => run(() => addTopic(subjectId, name, topics.length), treeKey) : undefined}
          onRemove={(id) => run(() => deleteFrom("academia_topics", id), treeKey)}
          empty={subjectId ? "Add your first Topic." : "Choose a Subject first."}
          addLabel="New topic"
        />
        <Column
          title="Subtopics"
          items={subtopics}
          selected={subtopicId}
          onSelect={setSubtopicId}
          onAdd={topicId ? (name) => run(() => addSubtopic(topicId, name, subtopics.length), treeKey) : undefined}
          onRemove={(id) => run(() => deleteFrom("academia_subtopics", id), treeKey)}
          empty={topicId ? "Add a Subtopic." : "Choose a Topic first."}
          addLabel="New subtopic"
        />
        <Column
          title="Sessions"
          items={sessions.map((s, i) => ({ id: s.id, name: `${i + 1}. ${s.title}` }))}
          selected={null}
          onSelect={(id) => navigate(`/academia/session/${id}`)}
          onAdd={
            subtopicId
              ? (name) =>
                  run(async () => {
                    const id = await addSession(subtopicId, name, sessions.length);
                    navigate(`/academia/session/${id}`);
                  }, ["academia-sessions", subtopicId])
              : undefined
          }
          onRemove={(id) => run(() => deleteFrom("academia_sessions", id), ["academia-sessions", subtopicId])}
          empty={subtopicId ? "Add a Session, then open it to add Activities." : "Choose a Subtopic first."}
          addLabel="New session"
        />
      </div>
    </>,
  );
};

export default TeacherAcademiaPage;
