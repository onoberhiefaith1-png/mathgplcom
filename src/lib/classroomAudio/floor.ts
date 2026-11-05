export interface AudioFloor {
  speakerId: string | null;
  moderatorId: string | null;
  studentsMuted: boolean;
}

export type FloorCommand =
  | { type: "request" | "release" }
  | { type: "pass"; studentId: string }
  | { type: "mute"; studentId: string }
  | { type: "mute-all" | "allow-students" }
  | { type: "appoint"; studentId: string | null };

/** Who may send voice. The teacher and the promoted admin may, plus the one student who holds the floor. */
export function allowedPublishers(floor: AudioFloor, teacherId: string): Set<string> {
  const allowed = new Set<string>();
  if (teacherId) allowed.add(teacherId);
  if (floor.moderatorId) allowed.add(floor.moderatorId);
  if (floor.speakerId && !floor.studentsMuted) allowed.add(floor.speakerId);
  return allowed;
}

// Apply under a server-side room lock. Actor, teacher and membership come
// from authenticated server state, never from the client command.
export function updateAudioFloor(
  floor: AudioFloor,
  command: FloorCommand,
  actorId: string,
  teacherId: string,
  connectedStudents: ReadonlySet<string>,
): AudioFloor {
  const teacher = actorId === teacherId;
  const student = connectedStudents.has(actorId);
  const moderates = teacher || (student && floor.moderatorId === actorId);
  if (command.type === "request") {
    return student && !floor.studentsMuted && floor.speakerId === null
      ? { ...floor, speakerId: actorId }
      : floor;
  }
  if (command.type === "release") {
    return moderates || floor.speakerId === actorId ? { ...floor, speakerId: null } : floor;
  }
  if (command.type === "mute") {
    if (!moderates || !connectedStudents.has(command.studentId) || command.studentId === teacherId) return floor;
    return floor.speakerId === command.studentId ? { ...floor, speakerId: null } : floor;
  }
  if (command.type === "appoint") {
    return teacher && (command.studentId === null || connectedStudents.has(command.studentId))
      ? { ...floor, moderatorId: command.studentId }
      : floor;
  }
  if (!moderates) return floor;
  if (command.type === "mute-all") return { ...floor, speakerId: null, studentsMuted: true };
  if (command.type === "allow-students") return { ...floor, studentsMuted: false };
  if (command.type === "pass" && connectedStudents.has(command.studentId)) {
    return { ...floor, speakerId: command.studentId };
  }
  return floor;
}
