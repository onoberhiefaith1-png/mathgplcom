# Make Aura actually hear you

Right now the ear lights up but nothing is heard, and the recorder button does nothing. Two things confirmed in the code cause this:

1. **Two separate listeners fight over the same microphone.** The ear starts one listener and the recorder button starts a second one. A browser only allows one at a time, so whichever starts second fails instantly — and both places quietly swallow the failure, which is why you see no error, no words, and no response.
2. **Nothing shows what is being heard.** There is no live sound wave, no visible transcript while you speak, and no prompt asking for microphone permission — so even when the microphone is on, there is no way to tell.

## What you will get

- **One microphone, shared.** The ear and the recorder use the same single listener, so they can never cancel each other.
- **A live sound wave.** Real moving bars driven by your actual voice level — the same feel as recording a voice note — shown while the recorder is on, and also the moment you say "Aura".
- **"Aura" really wakes her.** Say her name and the wave appears, the words that follow are captured, and she acts on them. Say only her name and she opens and waits, listening, with the wave running.
- **Words on screen as you speak.** A live line of what she is hearing, so you always know it is working.
- **Honest failures.** If the microphone is blocked or the browser can't listen, she tells you in plain words and offers the permission prompt again instead of going silent.
- **She never hears herself.** While Aura is speaking, the wave pauses so her own voice can't trigger her.
