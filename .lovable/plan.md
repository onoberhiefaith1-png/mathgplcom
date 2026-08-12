# Connect the real platform-usage pipeline

Right now Usage Analytics and Cost & Revenue Analysis are structurally complete but empty: `usage_events` has 0 rows and every price in the price book is unset, so everything reads £0.00. This connects them to the real platform usage you see in the Usage panel (the 76.1 run credits over the last 90 days) and makes the unpaid position show as a loss.

## What the numbers will be

- Money unit: **1 credit = £0.30**. Stored as a rate, so it can be changed later without touching history.
- Real platform usage, mapped onto your six categories:

```text
Database   <- cloud database usage
Network    <- cloud egress + cached egress
Storage    <- cloud file storage
Compute    <- compute pico, worker days, worker requests, functions
Realtime   <- cloud realtime
AI         <- AI Gateway input/output tokens, image output, audio input (per model)
```

- Everything is billed to **your own Cost Unit** (Gabriel Onoberhie workspace) until other accounts generate their own usage.
- No payment recorded yet, so each event is status **Unpaid** and its financial result is negative. Your position reads **-£22.83** (76.1 credits x £0.30) for the 90-day window, and the ledger, category cards, chart and credit balance all agree with that one figure.
- The moment a payment or credit purchase is recorded, the same rows recompute to a positive result — the loss becomes profit automatically, without rewriting the stored cost snapshot.

## Where the data comes from

Your app cannot read Lovable's credit meter at runtime — there is no in-app API for it. So the pipeline has two ends:

1. **Import now.** I load the real 90-day usage, day by day and category by category, into the metering ledger, priced at £0.30/credit, attributed to your Cost Unit, marked Unpaid. The pages stop being blank immediately.
2. **Admin importer.** A new owner-only *Platform usage import* panel on Usage Analytics where a usage snapshot can be entered per category (or per AI model) for a date range, with a credit rate field. Re-importing the same day replaces that day rather than double-counting. That keeps the pages current between imports, and I can refresh it on request too.

App-generated metering (AI calls, storage uploads, compute) keeps writing into the same ledger as it already does, so imported platform usage and live app usage add up in one place, distinguished by source.

## What changes on the pages

- **Usage Analytics**: stacked chart, six category cards and the AI activity table fill with the real 90-day series; per-category drill-down lists the imported daily lines with credits, unit rate and cost.
- **Cost & Revenue Analysis**: Platform Cost £22.83, Collected £0.00, Unpaid exposure £22.83, Financial result -£22.83 in red. The ledger lists each day's rows with status Unpaid, and the credit balance panel shows your negative position.
- Nothing customer-facing changes; both pages stay platform-owner only.

## Technical section

- Migration (additive): `resource_prices` gains rows priced in credits with a `credit_rate` setting (£0.30) in `platform_cost_settings`; `usage_events` gains `source` (`app` | `platform_import`) and `import_day` with a unique key on (source, import_day, metric, model) so re-imports overwrite instead of duplicating.
- Import path: `src/lib/costs/platformImport.server.ts` + a `createServerFn` in `usage.functions.ts` behind `assertPlatformAdmin`, writing through the existing `record_usage_event` pricing/wallet logic so snapshots and statuses stay consistent.
- Payment flip: recording a payment/credit grant updates `amount_paid`/`payment_status` on the affected events and the derived financial result, leaving `actual_cost` and `profit_rate` snapshots untouched.
- UI: new `PlatformUsageImport` card in `src/pages/admin/UsageAnalytics.tsx`; existing queries and realtime subscription reused unchanged.
