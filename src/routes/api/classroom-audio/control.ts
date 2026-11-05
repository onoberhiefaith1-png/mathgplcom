import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/classroom-audio/control')({
  server: { handlers: { POST: async ({ request }) => {
    const { handleClassroomAudioRequest } = await import('@/lib/classroomAudio/control.server');
    return handleClassroomAudioRequest(request);
  } } },
});
