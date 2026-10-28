# Referral & Rewards Engine (role-based)

A referral engine, not a link. The link identifies the referrer; the system tracks
registration and subscription, applies the campaign's configured reward rule, and
calculates totals automatically. Reward values are never hard-coded — every amount,
currency and trigger comes from a campaign record.

## Who sees Referral

| Role | Referral dashboard |
| --- | --- |
| Platform administrator | Yes — global, plus campaign management |
| School administrator | Yes — school-scoped |
| Teacher | Yes — personal |
| Student, parent, guest | No — not shown in navigation at all |

## What gets built

1. **Refer & Earn card** on the teacher/school dashboards next to Lesson Notes,
   Classes, Skill Builder, Adventure — showing referred / registered / subscribed /
   earned, opening the full dashboard. A `Referral` entry is added to the left
   navigation for the three permitted roles only.
2. **Referral dashboard** (`/referral`), same shell for all three roles, scoped by
   who is looking: Overview cards → Your referral link (copy / share) → Referral
   activity table → Rewards (pending / earned / completed) → Performance.
3. **Campaign configuration** — reward type `payment | discount | other`, chosen
   from dropdowns:
   - *Payment*: currency (searchable list) + amount per referral.
   - *Discount*: percentage or fixed amount + value.
   - *Other*: free-text reward description (free course, extra access, certificate…).
   Plus a **reward trigger**: eligible on registration, or eligible on subscription.
   Reward type is stored as a string with a typed rule payload, so new types can be
   added later without touching existing campaigns.
4. **Automatic tracking**: link opened → registered → subscribed → eligible → reward.
   Eligibility is decided by the campaign trigger; totals are computed, never typed.
5. **Multi-currency correctness**: totals are grouped per currency and displayed
   separately. Amounts in different currencies are never summed.
6. **MathGPL is not the payment processor**: rewards move
   `pending → eligible → paid`, where "paid" is a manual mark by the administrator
   (or school administrator for its own school campaign) once money moved outside
   the platform.
7. **Status messages** generated from the reward state (referral registered, reward
   unlocked, reward pending, payment recorded), written so they can later be picked
   up by the notification system.
