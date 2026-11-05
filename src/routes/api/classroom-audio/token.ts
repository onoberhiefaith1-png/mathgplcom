import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/classroom-audio/token')({
  server: { handlers: { POST: async ({ request }) => {
    const { handleClassroomAudioRequest } = await import('@/lib/classroomAudio/token.server');
    return handleClassroomAudioRequest(request);
  } } },
});
