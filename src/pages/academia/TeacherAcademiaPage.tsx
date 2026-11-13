import AcademiaDuplicateMenu from "@/components/academia/AcademiaDuplicateMenu";
import SubjectMenu from "@/components/academia/mcq/SubjectMenu";
/**
 * Teacher Academia (Shared Workspace): School Classes read-only, only the
 * teacher's assigned Subjects, and Add Topic / Subtopic / Session.
 */
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, Loader2 } from "lucide-react";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import AcademiaHeader from "@/components/academia/AcademiaHeader";
import StudentAcademiaView from "@/components/academia/StudentAcademiaView";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { useAcademiaDrillTrail } from "@/hooks/useAcademiaDrillTrail";
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
  mySubjectIds,
} from "@/lib/academia/api";

const TeacherAcademiaPage = () => {
  const { active, activeOrgId, isLoading } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const shared = active?.kind === "school";
  // Only a school owns an Academia. A personal workspace sees the same
  // Academia view as a student (teacher tools appear inside each Session).
  const personal = false;
  const academiaQ = useQuery({
    queryKey: ["academia-org", activeOrgId],
    enabled: !!activeOrgId && shared,
    queryFn: () => academiaForWorkspace(activeOrgId!, false),
  });
  const academia = academiaQ.data;
  const treeQ = useQuery({
    queryKey: ["academia-tree", academia?.id],
    enabled: !!academia,
    queryFn: () => loadAcademiaTree(academia!.id),
  });
  const mineQ = useQuery({ queryKey: ["academia-mine"], queryFn: mySubjectIds });
  const tree = treeQ.data;
  const mine = useMemo(() => new Set(mineQ.data ?? []), [mineQ.data]);
  const drill = useAcademiaDrillTrail({
    active: shared && !!academia,
    academiaId: academia?.id ?? null,
    catalogReady: shared && treeQ.isSuccess && mineQ.isSuccess && !!academia,
    syncUrl: shared && !!academia,
    classes: tree?.classes ?? [],
    subjects: (tree?.subjects ?? []).filter((s) => mine.has(s.id)),
    topics: tree?.topics ?? [],
    subtopics: tree?.subtopics ?? [],
  });
  const { classId, subjectId, topicId, subtopicId } = drill;

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

  if (!isLoading && !shared) {
    return (
      <WorkspaceLayout title="Academia" collapsibleNav>
        <StudentAcademiaView syncUrl />
      </WorkspaceLayout>
    );
  }
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

  const classes = tree?.classes ?? [];
  const subjects = (tree?.subjects ?? []).filter((s) => s.class_id === classId && (personal || mine.has(s.id)));
  const topics = (tree?.topics ?? []).filter((t) => t.subject_id === subjectId);
  const subtopics = (tree?.subtopics ?? []).filter((s) => s.topic_id === topicId);
  const sessions = drill.sessions;
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
          onSelect={drill.selectClass}
          onAdd={personal ? (name) => run(() => addClass(academia.id, name, classes.length), treeKey) : undefined}
          onRemove={personal ? (id) => run(() => removeRow("academia_classes", id), treeKey) : undefined}
          addLabel="New class"
          empty={personal ? "Add your first Class." : "The school hasn't added Classes yet."}
        />
        <Column
          title={personal ? "Subjects" : "My Subjects"}
          menu={(id) => <SubjectMenu subjectId={id} duplicateName={subjects.find(s => s.id === id)?.name ?? "Subject"} />}
          items={subjects}
          onAdd={personal && classId ? (name) => run(() => addSubject(classId, name, subjects.length), treeKey) : undefined}
          onRemove={personal ? (id) => run(() => removeRow("academia_subjects", id), treeKey) : undefined}
          addLabel="New subject"
          selected={subjectId}
          onSelect={drill.selectSubject}
          empty={classId ? "No Subjects in this Class are assigned to you." : "Choose a Class first."}
        />
        <Column
          title="Topics"
          menu={(id) => <AcademiaDuplicateMenu kind="topic" id={id} name={topics.find(item => item.id === id)?.name ?? "Topic"} />}
          items={topics}
          selected={topicId}
          onSelect={drill.selectTopic}
          onAdd={subjectId ? (name) => run(() => addTopic(subjectId, name, topics.length), treeKey) : undefined}
          onRemove={(id) => run(() => deleteFrom("academia_topics", id), treeKey)}
          empty={subjectId ? "Add your first Topic." : "Choose a Subject first."}
          addLabel="New topic"
        />
        <Column
          title="Subtopics"
          menu={(id) => <AcademiaDuplicateMenu kind="subtopic" id={id} name={subtopics.find(item => item.id === id)?.name ?? "Subtopic"} />}
          items={subtopics}
          selected={subtopicId}
          onSelect={drill.selectSubtopic}
          onAdd={topicId ? (name) => run(() => addSubtopic(topicId, name, subtopics.length), treeKey) : undefined}
          onRemove={(id) => run(() => deleteFrom("academia_subtopics", id), treeKey)}
          empty={topicId ? "Add a Subtopic." : "Choose a Topic first."}
          addLabel="New subtopic"
        />
        <Column
          title="Sessions"
          menu={(id) => <AcademiaDuplicateMenu kind="session" id={id} name={sessions.find(item => item.id === id)?.title ?? "Session"} />}
          items={sessions.map((s, i) => ({ id: s.id, name: `${i + 1}. ${s.title}` }))}
          selected={drill.sessionId}
          onSelect={(id) => { drill.selectSession(id); navigate(`/academia/session/${id}`); }}
          onAdd={
            subtopicId
              ? (name) =>
                  run(async () => {
                    const id = await addSession(subtopicId, name, sessions.length);
                    drill.selectSession(id);
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
