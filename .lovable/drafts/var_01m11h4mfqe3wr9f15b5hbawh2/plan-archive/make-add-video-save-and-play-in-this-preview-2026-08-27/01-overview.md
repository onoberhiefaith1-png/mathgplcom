# Make "Add Video" save and play in this preview

## What is actually wrong

The video editor works, the upload works, but the save fails with *"The question video store isn't available on this preview yet."*

Reason, confirmed against the live database: the teaching-video records were designed to live in a brand-new table (`exercise_question_videos`) that does not exist yet. It was staged as a database change, and staged changes only reach the database when this draft is accepted — so nothing can be saved or tested here.

The storage side is fine: the `course-media` bucket already exists and the uploaded video file itself lands correctly.

## The fix

Stop depending on a new table. Store the video configuration inside the Exercise Card's own settings, which already exist and are already readable by students and writable by the teacher who owns the course.

One video per question, one ordered list of timestamp segments (Introduction, Line 1…n, Conclusion). Nothing about the video file changes: it stays a single uploaded file, sliced only by timestamps.
