# Credits since the new brain, and a credit figure on every reply

## What I found about your spend

I checked the recorded usage for the last few days. Since the switch to the lighter brain, today's Aura conversations used about **596,000 words-worth of input and 24,000 of output** — which prices out at roughly **0.6 credits for the whole day** (about 19p), against the ~73 credits a day the heavy brain was burning. That is the change you wanted, confirmed from real recorded numbers rather than an impression.

Two honesty notes:

- The internal money ledger currently shows **0.0000 credits for every AI event**, because the price list has no rate filled in for model input/output. So the dashboard total is not wrong on purpose — it is simply unpriced. The figure above comes from the recorded token counts priced at the model's published rates.
- Aura's quick front voice, the speaking voice, and the listening/transcription are **not recorded at all yet**, so any total that ignores them is incomplete.

## What I will build

1. **A credit figure under every completed reply**, exactly like Lovable shows per message: `0.00042 credits`, `0.0 credits` when nothing was used. Never rounded up to look big, never rounded down to zero when something was actually used.
2. **The whole turn counted, not a part of it** — quick reply, the working brain, the spoken voice, and transcription add into one number for that reply.
3. **Today's running total** in the existing "Cost today" strip, shown in credits as well as pence.
4. **Fill in the missing rates and records** so the ledger and the dashboard stop reporting zero for AI work, and the quick voice, speech and transcription are recorded like everything else.
