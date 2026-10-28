# Three layers: Create, Own, Discover

## First, the error you pasted

Two separate things are happening in that screenshot:

- The 504 on a Vite dependency file is a transient dev-server hiccup, not a code fault. It clears on reload.
- "Could not find the function public.community_directory" is the real one: the Community profile, network and media changes are staged in this draft and only reach the live backend when you **accept the draft**. Until then Teachers/Schools/Students/Parents show "0 of 0". That is why no teachers appear — not because the listings are missing.

Everything below is built in the same draft and becomes live on the same accept.

## What is wrong structurally

Personal Dashboard and Community currently share one shell, one sidebar and one visual language, so they read as two copies of the same page. The sidebar puts "My Dashboard" and "Discover people" side by side, which is exactly the confusion you described.

The fix is to split them into three clearly different environments and one ranking rule.

| Layer | Question it answers | Surface |
| --- | --- | --- |
| MathGPL workspace | "Where do I create?" | existing workspace — untouched |
| Personal Dashboard | "What belongs to me?" | my owned + shared content, no discovery |
| Community | "What can I discover?" | search-first public network |
| Public profile | "What has this teacher shared?" | that person's dashboard, read-only |
