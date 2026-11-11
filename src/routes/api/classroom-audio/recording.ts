import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/classroom-audio/recording')({
  server: { handlers: { POST: async ({ request }) => {
    const { handleClassroomRecordingRequest } = await import('@/lib/classroomAudio/recording.server');
    return handleClassroomRecordingRequest(request);
  } } },
});
