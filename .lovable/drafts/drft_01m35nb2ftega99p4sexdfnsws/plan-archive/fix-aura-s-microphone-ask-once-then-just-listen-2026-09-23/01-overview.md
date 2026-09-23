# Fix Aura's microphone: ask once, then just listen

The message you saw — "No microphone was found on this device" — is written by Aura, not by your computer. It appears whenever her single request for the microphone fails for a reason she doesn't recognise, so a blocked, busy or framed microphone all get reported as a missing one. That is the bug.

Two more things confirmed in her code cause the rest of what you saw:

- **She asks for the microphone twice.** The permission step opens the microphone and immediately closes it again, then the listening engine opens a second one. The second request is what actually fails, and its failure is reported with the wrong words.
- **Nothing starts after you allow.** Granting permission closes the box, but she doesn't begin listening until you go and press something else.

Your address is already secure (`https://mathgpl.com`), so that part needs no change.

## What you will get

- **One request, one microphone.** She asks once, keeps the microphone she is given, and listens with that same one — no second request that can fail.
- **Allow, and she is listening.** The moment you allow, she begins listening and says so; no extra button.
- **Four honest states, never the wrong one.** Not enabled · Asking · Listening · Blocked · and "no microphone" only when your device truly reports none.
- **A visible status light** in her panel: grey when off, amber while asking, green while listening, red when blocked — so you always know.
- **The bottom microphone button works everywhere.** Not allowed yet → asks. Allowed → starts listening. Listening → stops.
- **Plain fixes, not Windows settings.** Blocked shows how to unblock in the browser. Microphone in use by another app says so. A preview window that isn't allowed to pass the microphone through says that too.
