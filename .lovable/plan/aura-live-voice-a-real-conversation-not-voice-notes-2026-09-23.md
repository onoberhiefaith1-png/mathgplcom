# Aura live voice: a real conversation, not voice notes

Tapping the blue waveform button starts a conversation that stays open. Aura listens continuously, works out when you have finished your sentence, answers out loud, and stops mid-word the moment you speak over her. No button between turns, no send, no recording-and-uploading.

The input bar itself does not change: same box, same `+`, same microphone, same blue button. What changes is what happens behind the blue button.

## The six states

The waveform and the status line show exactly one of these:

```text
IDLE        not in a session
LISTENING   hearing you, words appearing as you speak
THINKING    your turn ended, she is preparing
SPEAKING    her voice is playing
INTERRUPTED you spoke over her; her voice cut off
WAITING     she finished, attentively waiting for you
```

Each state has its own waveform behaviour: LISTENING follows your voice, THINKING is a slow pulse, SPEAKING follows her own audio, WAITING is a calm resting line.

## How a turn works

1. Tap the blue button. Microphone permission is asked once if never granted before.
2. The session opens and stays open. Your words appear live in the conversation as you speak.
3. When you stop for a natural beat — long enough to be the end of a sentence, not a mid-sentence breath — your turn closes and is sent. Pauses inside a sentence do not send anything.
4. She streams her answer and begins speaking on the first fragment of audio, instead of waiting for the whole answer.
5. If you speak while she is speaking, her voice stops within a fraction of a second, the state shows INTERRUPTED, and your new sentence becomes the next turn. Everything said so far stays in the conversation, so "no, I meant the other part" makes sense to her.
6. When she finishes she goes to WAITING and simply stays there. You keep talking whenever you like.
7. The session ends only when you end it — a clear End button. Microphone released, any audio stopped, the bar returns to normal.

Speaking and typing are the same conversation. Every spoken turn appears in the chat history, and anything she does while speaking (creating a class, writing a note) shows up as the same step cards you already see.

## Barge-in, honestly

Her own voice must not interrupt her. The microphone stays open while she speaks, and only real speech above her own playback counts as an interruption: loudness plus a sustained pattern over a short window, with her current output volume taken into account. A cough or a door does not cut her off; a sentence does.

## The `+` button: attachments that become work

The `+` accepts photos, screenshots, PDFs and Word documents.

- She reads the attachment and talks about it in the conversation — a photo of a textbook page, a worksheet, a past paper.
- She can turn what she read into real work: a lesson note with sessions, questions written as micro-steps, solutions, and Floating Numbers — through the same abilities she already has, following the same order and the same mathematics rules.
- The file is kept with the lesson note it produced, so it can be opened again from the note.
- Attachments work in both voice and text. While in a voice session you can attach a page and simply say "work through question three".

## Who can use it

Everyone who can use Aura, including students, under the daily allowance she already respects. A voice session counts against that allowance while it is open, and the panel says so plainly when it is running low.

## What is not changing

The cockpit layout, the wake word, spoken replies toggle, teaching out loud, her platform abilities, the mathematics rules, the Smartboard, Floating Numbers and the Game.

## Technical notes

- **Engine.** Live pipeline on Lovable AI, not a record-upload-transcribe loop. Continuous browser speech recognition with interim results feeds the live transcript; a Web Audio analyser on the same stream drives level, voice-activity detection and end-of-turn timing. Where continuous recognition is unavailable (Safari, Firefox), the same session falls back to short rolling chunks through the gateway transcription endpoint — same states, slightly longer turn detection.
- **New module** `src/lib/agent/voiceSession.ts`: a state machine (`idle | listening | thinking | speaking | interrupted | waiting`) owning VAD thresholds, silence timers, turn close, interruption detection and cancellation. Unit-tested against synthetic level/transcript traces — no audio hardware needed for tests.
- **Reuse, don't duplicate.** `useListening.ts` stays the single microphone owner and gains a `session` mode beside `wake`/`capture`; `streamSpeech.ts` already streams PCM chunk-by-chunk and aborts cleanly, so barge-in cancels the existing `AbortController` and stops scheduled buffer sources immediately. `speech.server.ts` and `/api/aura-speech` are unchanged.
- **Answering sooner.** `agentChat` currently returns a whole reply. Add a sentence-level speech queue on the client so each finished sentence is spoken while the rest is still arriving, and speak the first sentence as soon as it exists.
- **Provider wiring.** `AuraProvider` gains `voice: { state, start, end, level, partial }`, drives the queue, and routes each closed turn through the existing `send`, so context, tools, steps, usage limits and history stay one path.
- **Attachments.** New `aura_attachments` storage bucket plus a row per file, owner-scoped with row-level security; the gateway call carries the file with its real detected type. A new ability reads an attachment, and the existing lesson-note abilities consume the text it produced. Attachment rows link to the lesson note they created.
- **Cockpit.** `AuraCockpit` renders the state, the End control and the attachment tray; `AuraWaveform` gains per-state animation. No layout change.

## Order of work

1. `voiceSession.ts` state machine and its tests.
2. Continuous listening mode and level-based turn detection.
3. Sentence-queued streaming speech with instant barge-in cancellation.
4. Cockpit states, waveform behaviour, End control.
5. Attachments: bucket, upload, reading, and turning a page into a lesson note.
6. End-to-end check in the browser: greeting, interruption mid-sentence, resumed turn, attachment read, session end.
