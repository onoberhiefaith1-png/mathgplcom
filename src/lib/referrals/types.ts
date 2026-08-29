/**
 * Referral & Rewards vocabulary.
 *
 * A reward is never a hard-coded amount: it is a rule (type + value + currency)
 * plus the moment it becomes eligible. Adding a new reward type later means
 * adding a value here, not rewriting the engine.
 */

export type RewardType = "payment" | "discount" | "other";
export type TriggerEvent = "registration" | "subscription";
export type DiscountKind = "percentage" | "fixed";
export type RewardStatus = "pending" | "eligible" | "paid";
export type ReferralScope = "platform" | "school" | "teacher";

export const REWARD_TYPES: { value: RewardType; label: string; blurb: string }[] = [
  { value: "payment", label: "Payment", blurb: "A cash amount per qualifying referral." },
  { value: "discount", label: "Discount", blurb: "A percentage or fixed reduction." },
  { value: "other", label: "Other reward", blurb: "Free course, extra access, certificate…" },
];

export const TRIGGERS: { value: TriggerEvent; label: string; blurb: string }[] = [
  {
    value: "registration",
    label: "When someone registers",
    blurb: "Eligible as soon as the person registers with the link.",
  },
  {
    value: "subscription",
    label: "When someone subscribes",
    blurb: "Eligible only after the person subscribes.",
  },
];

export type Currency = { code: string; symbol: string; name: string };

/** A starting list. Any ISO code may be stored — this only drives the picker. */
export const CURRENCIES: Currency[] = [
  { code: "GBP", symbol: "£", name: "British pound" },
  { code: "USD", symbol: "$", name: "US dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "NGN", symbol: "₦", name: "Nigerian naira" },
  { code: "CAD", symbol: "CA$", name: "Canadian dollar" },
  { code: "AUD", symbol: "A$", name: "Australian dollar" },
  { code: "ZAR", symbol: "R", name: "South African rand" },
  { code: "INR", symbol: "₹", name: "Indian rupee" },
  { code: "GHS", symbol: "₵", name: "Ghanaian cedi" },
  { code: "KES", symbol: "KSh", name: "Kenyan shilling" },
  { code: "AED", symbol: "AED", name: "UAE dirham" },
  { code: "JPY", symbol: "¥", name: "Japanese yen" },
];

export const currencySymbol = (code?: string | null): string =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? code ?? "";

/** Money is always shown with its own currency — never merged across currencies. */
export const formatMoney = (amount: number, currency?: string | null): string => {
  const symbol = currencySymbol(currency);
  const value = Number.isInteger(amount) ? amount.toString() : amount.toFixed(2);
  return symbol.length <= 2 ? `${symbol}${value}` : `${symbol} ${value}`;
};

export type RewardRule = {
  currency?: string;
  amount?: number;
  discountKind?: DiscountKind;
  description?: string;
};

export type Campaign = {
  id: string;
  ownerKind: ReferralScope;
  ownerUserId: string;
  orgId: string | null;
  name: string;
  rewardType: RewardType;
  rewardRule: RewardRule;
  trigger: TriggerEvent;
  isActive: boolean;
};

/** One line of the reward rule, in plain words. */
export const rewardRuleLabel = (campaign: Pick<Campaign, "rewardType" | "rewardRule">): string => {
  const rule = campaign.rewardRule ?? {};
  if (campaign.rewardType === "payment") {
    return formatMoney(rule.amount ?? 0, rule.currency);
  }
  if (campaign.rewardType === "discount") {
    return rule.discountKind === "fixed"
      ? `${formatMoney(rule.amount ?? 0, rule.currency)} off`
      : `${rule.amount ?? 0}% off`;
  }
  return rule.description?.trim() || "Reward";
};

export type CurrencyTotal = { currency: string; amount: number };

export type ReferralRow = {
  id: string;
  label: string;
  role: string | null;
  registeredAt: string | null;
  subscribedAt: string | null;
  status: RewardStatus;
  rewardType: RewardType;
  currency: string | null;
  amount: number | null;
  description: string | null;
  rewardLabel: string;
};

export type ReferralOverview = {
  referred: number;
  registered: number;
  subscribed: number;
  eligible: number;
  conversionRate: number;
  earned: CurrencyTotal[];
  pending: CurrencyTotal[];
  paid: CurrencyTotal[];
  nonCashRewards: number;
};

export type TopReferrer = { referrerUserId: string; label: string; registered: number; subscribed: number };

export type ReferralDashboard = {
  scope: ReferralScope;
  link: { code: string; url: string } | null;
  campaign: Campaign | null;
  campaigns: Campaign[];
  overview: ReferralOverview;
  rows: ReferralRow[];
  topReferrers: TopReferrer[];
  canConfigure: boolean;
};

export type ActivityFilter =
  | "all"
  | "teacher"
  | "school"
  | "student"
  | "parent"
  | "registered"
  | "subscribed"
  | "pending"
  | "paid";

export const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "teacher", label: "Teachers" },
  { value: "school", label: "Schools" },
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" },
  { value: "registered", label: "Registered" },
  { value: "subscribed", label: "Subscribed" },
  { value: "pending", label: "Pending reward" },
  { value: "paid", label: "Reward completed" },
];

/** The status message shown for one referral, generated from its state. */
export const referralMessage = (row: ReferralRow): string => {
  if (row.status === "paid") return `Payment recorded — ${row.rewardLabel} marked as completed.`;
  if (row.status === "eligible") return `Reward unlocked — you have earned ${row.rewardLabel}.`;
  if (row.subscribedAt) return "Reward pending — the required action is complete, awaiting review.";
  return "Referral successful — someone registered using your referral link.";
};

/** Adds one reward into a per-currency total list; never merges currencies. */
export const addTotal = (list: CurrencyTotal[], currency: string | null, amount: number | null) => {
  if (!currency || amount == null) return list;
  const existing = list.find((t) => t.currency === currency);
  if (existing) existing.amount += amount;
  else list.push({ currency, amount });
  return list;
};
