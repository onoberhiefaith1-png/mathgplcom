/** Presentation timing only; reward activation never waits for this effect. */
export const ENERGY_BALL_ARRIVAL_MS = 800;
export const ENERGY_BALL_CENTRE_MS = 3000;
/** One complete centre rotation lasts exactly three seconds. */
export const ENERGY_BALL_SPIN_MS = 3000;
export const ENERGY_BALL_FADE_MS = 200;
export const ENERGY_BALL_LIFETIME_MS = ENERGY_BALL_ARRIVAL_MS + ENERGY_BALL_CENTRE_MS + ENERGY_BALL_FADE_MS;