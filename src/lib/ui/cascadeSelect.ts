/** Reset child picks instantly when a parent in Class → Subject → Topic → Subtopic → Session changes. */
export type AcademiaAssignPath = {
  classId: string;
  subjectId: string;
  topicId: string;
  subtopicId: string;
  sessionId: string;
};

export const emptyAssignPath = (): AcademiaAssignPath => ({
  classId: "", subjectId: "", topicId: "", subtopicId: "", sessionId: "",
});

export const selectAssignLevel = (
  path: AcademiaAssignPath,
  level: keyof AcademiaAssignPath,
  id: string,
): AcademiaAssignPath => {
  const next = { ...path, [level]: id };
  if (level === "classId") return { ...next, subjectId: "", topicId: "", subtopicId: "", sessionId: "" };
  if (level === "subjectId") return { ...next, topicId: "", subtopicId: "", sessionId: "" };
  if (level === "topicId") return { ...next, subtopicId: "", sessionId: "" };
  if (level === "subtopicId") return { ...next, sessionId: "" };
  return next;
};
