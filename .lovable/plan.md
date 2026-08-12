# Plans as the single source of truth — close the last gap to checkout

## What I verified first (so the fix targets the real cause)

- The published Teacher Pro version in the database is already **£11.00** (platform £6.00 + credit budget £5.00, version 4, published today at 21:01). Included credits 10.75. So the plan record is correct.
- The Pricing pipeline panel is **already read-only and already derived**: its "Published" column is computed live from the published plan version, and its "At checkout" column is read from the payment provider. There is no separate editable pipeline price anywhere in the code or database.
- The £9.99 you are seeing is therefore **not a stale copy inside the app** — it is the amount still sitting at the payment provider. The automatic push that runs on publish failed silently: publish calls the sync in a "quiet" wrapper that logs the error and swallows it, and the provider calls were failing with the authentication error you hit earlier.
- Consequence, and the real risk: `/plans` shows the derived £11 while the provider would still charge £9.99, because checkout opens the provider's price object.

So the architecture you described is already in place. What is missing is (a) the push actually succeeding and never failing silently, and (b) refusing to charge a price that disagrees with the published plan.

## What will change

### 1. Publishing reports its own result
Publishing a version pushes prices to test and live and returns what moved. If the push fails, the publish confirmation says so explicitly ("Published — but checkout still shows £9.99, press Push prices to checkout") instead of appearing to succeed. Publishing the plan itself never fails because of a provider problem.

### 2. Pipeline stays read-only, but becomes explicit
The panel keeps only the derived columns and the single **Push prices to checkout** action, with clearer wording:
- Published (from the live plan version) — read-only
- At checkout (from the provider) — read-only
- State: In sync / **Out of sync — checkout charges £9.99, published £11.00** / Not created

Out-of-sync rows are shown in a warning colour with the exact discrepancy spelled out, and the environment (test/live) is labelled so it is obvious which catalogue is being compared. Live is shown alongside test rather than test only.

### 3. Checkout refuses to charge a price that disagrees
Before the overlay opens, the plan's published amount is compared with the provider price. If they differ, checkout does not open; the customer sees "This plan is being updated, please try again shortly" and the administrator sees the drift in the pipeline panel. This makes a silent underprice or overprice impossible.

### 4. Live Economics reads as inputs vs derived
The economics block at the top of `/admin/plans` labels **Credit cost price** and **Profit percentage** as the only editable inputs, and shows **Credit sell price** as derived (`cost × (1 + profit/100)`), displayed to the penny with the exact value beside it (£0.47, exact £0.4650). Per plan, Customer price (`platform + credit budget`) and Included credits (`credit budget ÷ sell price`) are shown as derived, non-editable figures next to the two fields you do edit. No new editable price fields are introduced.

### 5. Nothing about Paddle is rebuilt
Existing plan keys, provider price external ids (`teacher_pro_monthly`, `school_pro_monthly`, `parent_pro_monthly`, `credits_*`), the webhook, and the version/draft workflow all stay exactly as they are. Prices are updated in place at the provider; no duplicate products or prices are created. Save draft / Publish version is untouched.

## How to check it afterwards

1. Open `/admin/plans`. Teacher Pro shows Customer price £11.00 and Included credits 10.75, both derived.
2. Press **Push prices to checkout**. The Teacher Pro row flips to In sync with At checkout £11.00.
3. Open `/plans` and start Teacher Pro checkout — the overlay total reads £11.00.
4. Change Teacher Pro to platform £7 / credit £5, Save draft: `/plans` still shows £11. Publish: the confirmation reports the push, the pipeline shows £12.00 in both columns, and `/plans` and checkout both read £12.00.

## Technical notes

- `publishPlan` returns `{ plans, sync: { updated, missing, failed } }` from a non-throwing `syncCatalog` per environment; `PlanDashboard` surfaces it in the publish toast. `syncCatalogQuietly` is replaced by that reporting variant.
- `catalogStatus` gains `environment` in each row and is fetched for both `sandbox` and `live`; `CatalogRow` adds nothing editable. The panel keeps a single mutation (`syncPaymentCatalogFn`) per environment.
- New server function `verifyPlanPrice({ planKey, environment })` in `plans.functions.ts` compares the published `plan_versions.price` against the provider's active price (reusing `providerPrice` from `catalogSync.server.ts`) and returns `{ ok, published, provider }`. `usePaddleCheckout` calls it before `Paddle.Checkout.open` and aborts on mismatch.
- Presentation-only edits in `PlanDashboard.tsx` and `PlansPage.tsx` for the derived/input labelling; `sellPrice.ts` remains the single derivation. No schema changes, no new tables, no changes to `plan_versions`, webhook, or credit-grant logic.

## Next, after this lands

Teacher and School self-serve subscription: Free vs Pro on the account's own page, card added through the provider's hosted checkout, provider owning the customer and subscription record (you are not in the middle of the transaction), with the account's plan state driven only by verified webhook events. Teacher first, then the School equivalent.
