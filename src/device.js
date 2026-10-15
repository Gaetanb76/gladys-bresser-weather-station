// Shared device/feature declarations, used by BOTH processes:
//   - src/index.js     (main container)      -> publishes discovery + widget
//   - src/receiver.js  (companion container) -> publishes the live states
//
// gladys.externalIds(type, platformId) is a pure local computation, so both
// processes compute byte-identical external_id strings from the same two
// arguments. That is what lets the companion publish states for features it
// did not declare itself.
//
// Category / type / unit names were checked against
// @gladysassistant/integration-sdk 0.14.0 (DEVICE_FEATURE_CATEGORIES,
// DEVICE_FEATURE_TYPES, DEVICE_FEATURE_UNITS). Gladys validates the
// category/type/unit combination when the user clicks "create" in the
// Discovery tab; names in the SDK are plain strings (not multilingual).

export const STATION_PLATFORM_ID = "bresser-7002580";
export const DEVICE_TYPE = "weather_station";

export function buildFeatureDefinitions(C, T, U) {
  const decimal = T.SENSOR.DECIMAL;
  return [
    { key: "temp_out", name: "Température extérieure", category: C.TEMPERATURE_SENSOR, type: decimal, unit: U.CELSIUS, min: -60, max: 70 },
    { key: "hum_out", name: "Humidité extérieure", category: C.HUMIDITY_SENSOR, type: decimal, unit: U.PERCENT, min: 0, max: 100 },
    { key: "dew_point", name: "Point de rosée", category: C.TEMPERATURE_SENSOR, type: decimal, unit: U.CELSIUS, min: -80, max: 60 },
    { key: "temp_in", name: "Température intérieure", category: C.TEMPERATURE_SENSOR, type: decimal, unit: U.CELSIUS, min: -30, max: 70 },
    { key: "hum_in", name: "Humidité intérieure", category: C.HUMIDITY_SENSOR, type: decimal, unit: U.PERCENT, min: 0, max: 100 },
    { key: "pressure", name: "Pression atmosphérique", category: C.PRESSURE_SENSOR, type: decimal, unit: U.HECTO_PASCAL, min: 850, max: 1100 },
    { key: "wind_speed", name: "Vitesse du vent", category: C.SPEED_SENSOR, type: decimal, unit: U.KILOMETER_PER_HOUR, min: 0, max: 300 },
    { key: "wind_gust", name: "Rafale de vent", category: C.SPEED_SENSOR, type: decimal, unit: U.KILOMETER_PER_HOUR, min: 0, max: 300 },
    // integer: the Gladys dashboard only has an icon for an integer angle sensor
    { key: "wind_direction", name: "Direction du vent", category: C.ANGLE_SENSOR, type: T.SENSOR.INTEGER, unit: U.DEGREE, min: 0, max: 360 },
    // text, derived from wind_direction (see windCardinal); min/max are NOT NULL in Gladys even for text
    { key: "wind_cardinal", name: "Direction du vent (N, NE…)", category: C.TEXT, type: T.TEXT.TEXT, min: 0, max: 0, keep_history: false },
    { key: "rain_rate", name: "Pluie (dernière heure)", category: C.PRECIPITATION_SENSOR, type: decimal, unit: U.MILLIMETER_PER_HOUR, min: 0, max: 500 },
    // a precipitation sensor in mm/day (the dashboard has no icon for a decimal rain sensor)
    { key: "rain_daily", name: "Pluie cumulée du jour", category: C.PRECIPITATION_SENSOR, type: decimal, unit: U.MILLIMETER_PER_DAY, min: 0, max: 2000 },
  ];
}

export const INDOOR_KEYS = ["temp_in", "hum_in"];

const CARDINALS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

/** 0..360 degrees -> "N", "NE", "E", "SE", "S", "SO", "O", "NO" (French initials, 45° sectors). */
export function windCardinal(degrees) {
  return CARDINALS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

/** Adds the values derived from the raw readings (same for both data sources). */
export function withDerivedReadings(readings) {
  if (!Number.isFinite(readings.wind_direction)) return readings;
  const wind_direction = Math.round(readings.wind_direction) % 360;
  return { ...readings, wind_direction, wind_cardinal: windCardinal(wind_direction) };
}

// indoor=false (Wunderground API mode): the API never returns the console's
// indoor sensor, so those two features are not offered.
export function buildDiscoveredDevice(gladys, C, T, U, { indoor = true } = {}) {
  const ids = gladys.externalIds(DEVICE_TYPE, STATION_PLATFORM_ID);
  const features = buildFeatureDefinitions(C, T, U)
    .filter((def) => indoor || !INDOOR_KEYS.includes(def.key))
    .map((def) => ({
    name: def.name,
    external_id: ids.feature(def.key),
    category: def.category,
    type: def.type,
    unit: def.unit,
    min: def.min,
    max: def.max,
    read_only: true,
    has_feedback: false,
    keep_history: def.keep_history ?? true,
  }));
  return { device: { name: "Station météo Bresser", external_id: ids.device, features }, ids };
}
