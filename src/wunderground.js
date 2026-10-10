// Parsing and unit conversion for the Weather Underground "updateweatherstation"
// upload protocol, as sent by the Bresser 7002580 (Pro Weather Link) console:
//
//   GET /weatherstation/updateweatherstation.php?ID=...&PASSWORD=...
//       &action=updateraww&realtime=1&rtfreq=5&dateutc=now
//       &baromin=29.85&tempf=56.6&dewptf=53.0&humidity=88
//       &windspeedmph=4.2&windgustmph=4.9&winddir=292
//       &rainin=0.0&dailyrainin=0.12
//       &indoortempf=70.7&indoorhumidity=59
//
// Everything is imperial; it is converted to metric here. ID and PASSWORD
// (the Wunderground station credentials) are deliberately never read or
// logged by this code.
//
// The protocol carries no battery information.

const IN_TO_MM = 25.4;
const INHG_TO_HPA = 33.8639;
const MPH_TO_KMH = 1.60934;

const round1 = (n) => Math.round(n * 10) / 10;
const f2c = (f) => round1((f - 32) / 1.8);

// [feature key, query field, converter, plausible [min, max] after conversion]
// Out-of-range values (e.g. -9999 for a missing sensor) are dropped.
const FIELDS = [
  ["temp_out", "tempf", f2c, [-60, 70]],
  ["dew_point", "dewptf", f2c, [-80, 60]],
  ["hum_out", "humidity", Number, [0, 100]],
  ["temp_in", "indoortempf", f2c, [-30, 70]],
  ["hum_in", "indoorhumidity", Number, [0, 100]],
  ["pressure", "baromin", (v) => round1(v * INHG_TO_HPA), [850, 1100]],
  ["wind_speed", "windspeedmph", (v) => round1(v * MPH_TO_KMH), [0, 300]],
  ["wind_gust", "windgustmph", (v) => round1(v * MPH_TO_KMH), [0, 300]],
  ["wind_direction", "winddir", Number, [0, 360]],
  ["rain_rate", "rainin", (v) => round1(v * IN_TO_MM), [0, 500]], // rain over the past hour
  ["rain_daily", "dailyrainin", (v) => round1(v * IN_TO_MM), [0, 2000]],
];

/**
 * @param {string|URLSearchParams} query raw query string (with or without "?")
 * @returns {Record<string, number>} metric readings; only valid fields present
 */
export function parseWundergroundQuery(query) {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(String(query).replace(/^\?/, ""));
  const readings = {};
  for (const [key, field, convert, [min, max]] of FIELDS) {
    const raw = params.get(field);
    if (raw === null || raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    const value = convert(n);
    if (!Number.isFinite(value) || value < min || value > max) continue;
    readings[key] = value;
  }
  return readings;
}
