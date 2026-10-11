// Mode "Wunderground API": reads the current observation of a personal
// weather station (PWS) from Weather Underground's public API, with the
// station ID and API key the owner enters in the integration's settings.
//
//   GET https://api.weather.com/v2/pws/observations/current
//       ?stationId=ID&format=json&units=m&apiKey=KEY
//
// With units=m the values are already metric (km/h, hPa, mm). The API does
// NOT return the console's indoor sensor, so indoor values are never present
// in this mode. The API key is never logged.

const ENDPOINT = "https://api.weather.com/v2/pws/observations/current";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** @param {object} body parsed JSON answer of the API @returns {Record<string, number>} */
export function parseObservation(body) {
  const obs = body?.observations?.[0];
  if (!obs) return {};
  const m = obs.metric ?? {};
  const raw = {
    temp_out: num(m.temp),
    dew_point: num(m.dewpt),
    hum_out: num(obs.humidity),
    pressure: num(m.pressure),
    wind_speed: num(m.windSpeed),
    wind_gust: num(m.windGust),
    wind_direction: num(obs.winddir),
    rain_rate: num(m.precipRate),
    rain_daily: num(m.precipTotal),
  };
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
}

/** @returns {Promise<Record<string, number>>} readings; throws on HTTP/network errors (message never contains the key) */
export async function fetchObservation(stationId, apiKey, fetchImpl = fetch) {
  const url = `${ENDPOINT}?stationId=${encodeURIComponent(stationId)}&format=json&units=m&apiKey=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (res.status === 204) return {}; // station offline / no recent data
  if (res.status === 401 || res.status === 403) throw new Error("Wunderground refused the API key (HTTP " + res.status + ")");
  if (!res.ok) throw new Error("Wunderground API answered HTTP " + res.status);
  return parseObservation(await res.json());
}
