// Parsing and unit conversion for the Ecowitt upload protocol.
//
// The Bresser 5-in-1 WiFi console (WSLink / WSView Plus app, "Customized"
// upload, protocol "Ecowitt") POSTs a single
// application/x-www-form-urlencoded body to /data/report. Fine Offset's
// Ecowitt protocol always reports in imperial units internally regardless
// of what the console's own display shows, so every value below is
// converted to metric before it reaches Gladys.
//
// Reference fields used here (a real payload carries many more; unknown
// fields are simply ignored):
//   tempf, humidity                -> outdoor temperature / humidity
//   tempinf, humidityin            -> indoor temperature / humidity
//   baromabsin                     -> absolute pressure
//   windspeedmph, windgustmph      -> wind speed
//   winddir                        -> wind direction (already degrees)
//   rainratein, dailyrainin        -> rain rate / daily accumulation
//   wh65batt (or wh26batt)         -> 5-in-1 sensor array battery (0 = ok, 1 = low)

const F_OFFSET = 32;
const F_TO_C_FACTOR = 1 / 1.8;
const INHG_TO_HPA = 33.8639;
const MPH_TO_KMH = 1.60934;
const IN_TO_MM = 25.4;

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fahrenheitToCelsius(f) {
  const n = toNumber(f);
  return n === null ? null : round1((n - F_OFFSET) * F_TO_C_FACTOR);
}

function inHgToHpa(inHg) {
  const n = toNumber(inHg);
  return n === null ? null : round1(n * INHG_TO_HPA);
}

function mphToKmh(mph) {
  const n = toNumber(mph);
  return n === null ? null : round1(n * MPH_TO_KMH);
}

function inToMm(inches) {
  const n = toNumber(inches);
  return n === null ? null : round1(n * IN_TO_MM);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Parses a raw Ecowitt upload body (application/x-www-form-urlencoded)
 * into a flat object of metric readings keyed by the feature keys used in
 * index.js / externalIds(...).feature(key).
 *
 * @param {string} rawBody
 * @returns {Record<string, number|null>}
 */
export function parseEcowittPayload(rawBody) {
  const data = Object.fromEntries(new URLSearchParams(rawBody));

  const batteryRaw = toNumber(data.wh65batt ?? data.wh26batt);

  return {
    temp_out: fahrenheitToCelsius(data.tempf),
    hum_out: toNumber(data.humidity),
    temp_in: fahrenheitToCelsius(data.tempinf),
    hum_in: toNumber(data.humidityin),
    pressure: inHgToHpa(data.baromabsin ?? data.baromrelin),
    wind_speed: mphToKmh(data.windspeedmph),
    wind_gust: mphToKmh(data.windgustmph),
    wind_direction: toNumber(data.winddir),
    rain_rate: inToMm(data.rainratein),
    rain_daily: inToMm(data.dailyrainin),
    // 0 = battery ok, 1 = battery low (Ecowitt convention)
    battery_low: batteryRaw === null ? null : batteryRaw > 0 ? 1 : 0,
  };
}
