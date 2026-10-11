// Pure astronomical calculation of the moon phase - no external API needed.
//
// Reference: a known new moon (6 January 2000, 18:14 UTC) plus the mean
// synodic month length. This gives illumination accurate to roughly
// +/- 1% over any reasonable date range, which is more than enough for a
// dashboard widget.

const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {Date} date
 * @returns {{ phase: number, illuminationPercent: number, phaseName: string, phaseKey: string }}
 *   phase: 0..1 position in the synodic cycle (0 = new moon, 0.5 = full moon)
 *   illuminationPercent: 0..100, the visible illuminated fraction
 */
export function getMoonPhase(date = new Date()) {
  const diffDays = (date.getTime() - KNOWN_NEW_MOON_UTC) / MS_PER_DAY;
  let phase = (diffDays % SYNODIC_MONTH_DAYS) / SYNODIC_MONTH_DAYS;
  if (phase < 0) phase += 1;

  const illuminationPercent = Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 1000) / 10;
  const { key, label } = phaseName(phase);

  return { phase, illuminationPercent, phaseKey: key, phaseName: label };
}

function phaseName(phase) {
  if (phase < 0.03 || phase >= 0.97) return { key: "new_moon", label: { en: "New Moon", fr: "Nouvelle lune" } };
  if (phase < 0.22) return { key: "waxing_crescent", label: { en: "Waxing Crescent", fr: "Premier croissant" } };
  if (phase < 0.28) return { key: "first_quarter", label: { en: "First Quarter", fr: "Premier quartier" } };
  if (phase < 0.47) return { key: "waxing_gibbous", label: { en: "Waxing Gibbous", fr: "Lune gibbeuse croissante" } };
  if (phase < 0.53) return { key: "full_moon", label: { en: "Full Moon", fr: "Pleine lune" } };
  if (phase < 0.72) return { key: "waning_gibbous", label: { en: "Waning Gibbous", fr: "Lune gibbeuse decroissante" } };
  if (phase < 0.78) return { key: "last_quarter", label: { en: "Last Quarter", fr: "Dernier quartier" } };
  return { key: "waning_crescent", label: { en: "Waning Crescent", fr: "Dernier croissant" } };
}

/**
 * Dates of the next new moon and full moon (mean cycle, same accuracy as
 * getMoonPhase: within about half a day).
 *
 * @param {Date} date
 * @returns {{ nextNewMoon: Date, nextFullMoon: Date }}
 */
export function getNextMoonEvents(date = new Date()) {
  const { phase } = getMoonPhase(date);
  const daysUntil = (target) => (((target - phase) % 1) + 1) % 1 * SYNODIC_MONTH_DAYS || SYNODIC_MONTH_DAYS;
  return {
    nextNewMoon: new Date(date.getTime() + daysUntil(0) * MS_PER_DAY),
    nextFullMoon: new Date(date.getTime() + daysUntil(0.5) * MS_PER_DAY),
  };
}
