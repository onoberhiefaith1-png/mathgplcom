# A join link that copies, and opens straight into the session

Two things are broken about the invite link today.

1. **Copy fails.** The Copy button uses only the browser clipboard API, which is blocked inside the preview frame, so it shows "Copy failed" and nothing lands on the clipboard.
2. **The link is not shareable.** It is built from whatever address the page happens to be on, so in the preview it becomes a long internal sandbox address (`https://30005c61-...-thr_pfk...`). Sent to a student, that address does not open the session.

What it should do: one clean link that copies reliably, and when an audience member opens it they land inside the session with no sign-up and no form.
