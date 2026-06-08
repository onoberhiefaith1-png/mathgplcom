export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_MAX_POS: Record<Difficulty, number> = {
  // 0=units, 1=tens, 2=hundreds, 3=thousands, 4=ten-thousands
  easy: 1,
  medium: 2,
  hard: 4,
};

/** Place value of a digit at position p in number n (returns 0 if digit isn't at p). */
export const placeValueAt = (digit: number, n: number, p: number): number => {
  const d = Math.floor(n / Math.pow(10, p)) % 10;
  return d === digit ? digit * Math.pow(10, p) : 0;
};

/** Returns the place value of the (rightmost-found) target digit in n. */
export const placeValueOf = (digit: number, n: number): number => {
  const s = String(n);
  for (let i = 0; i < s.length; i++) {
    if (Number(s[i]) === digit) {
      const p = s.length - 1 - i;
      return digit * Math.pow(10, p);
    }
  }
  return 0;
};

export interface RoundQuestion {
  number: number;
  /** Position of target digit (0=units). */
  position: number;
  /** Correct place value (e.g. 700). */
  answer: number;
  /** Digits of the answer, left to right (e.g. [7,0,0]). */
  answerDigits: number[];
}

export interface Round {
  digit: number;
  slotCount: number;
  questions: RoundQuestion[];
}

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const buildNumberWithDigitAt = (digit: number, position: number, totalDigits: number) => {
  // total digits chosen >= position+1
  let s = "";
  for (let p = totalDigits - 1; p >= 0; p--) {
    if (p === position) {
      s += String(digit);
    } else if (p === totalDigits - 1) {
      // leading digit must not be 0 and must not be the target digit (no duplicates of target)
      let d = rand(1, 9);
      while (d === digit) d = rand(1, 9);
      s += String(d);
    } else {
      let d = rand(0, 9);
      // avoid putting target digit elsewhere (so place value is unambiguous)
      while (d === digit) d = rand(0, 9);
      s += String(d);
    }
  }
  return Number(s);
};

export const generateRound = (
  difficulty: Difficulty,
  digit: number,
  count: number,
): Round => {
  const maxPos = DIFFICULTY_MAX_POS[difficulty];
  const positions: number[] = [];
  // Always include the maximum position once so slot count is meaningful
  positions.push(maxPos);
  for (let i = 1; i < count; i++) {
    positions.push(rand(0, maxPos));
  }
  // shuffle
  positions.sort(() => Math.random() - 0.5);

  const questions: RoundQuestion[] = positions.map((pos) => {
    const totalDigits = Math.max(pos + 1, rand(pos + 1, Math.min(5, maxPos + 2)));
    const number = buildNumberWithDigitAt(digit, pos, totalDigits);
    const answer = digit * Math.pow(10, pos);
    const answerDigits = String(answer).split("").map(Number);
    return { number, position: pos, answer, answerDigits };
  });

  // Always show 5 slots so the box count never hints at the answer length.
  return { digit, slotCount: 5, questions };
};

export const pickNextDigit = (prev?: number) => {
  let d = rand(1, 9);
  while (d === prev) d = rand(1, 9);
  return d;
};

export const formatNumber = (n: number) => n.toLocaleString();
