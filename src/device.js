// Shared device/feature declarations, used by BOTH processes:
//   - src/index.js      (main container)    -> publishes discovery + widget
//   - src/receiver.js   (companion container) -> publishes the live states
//
// gladys.externalIds(type, platformId) is a pure, local computation (no
// network round trip), so as long as both processes call it with the same
// two arguments they end up with byte-identical external_id strings. That
// is what lets the companion container publish states for features it did
// not itself declare.
//
// NOTE: DEVICE_FEATURE_CATEGORIES / DEVICE_FEATURE_TYPES / DEVICE_FEATURE_UNITS
// are re-exported by @gladysassistant/integration-sdk and mirror Gladys'
// core enums. The exact constant names below (TEMPERATURE, HUMIDITY, RAIN,
// WIND_SPEED, WIND_DIRECTION, PRESSURE, BATTERY) match the public Gladys
// device-feature catalog at the time this was written. If `npx
// github:GladysAssistant/integration-store .` complains about an unknown
// type/category, run:
//   node -e "console.log(require('@gladysassistant/integration-sdk').DEVICE_FEATURE_TYPES)"
// and adjust the constant names here to match.

export const STATION_PLATFORM_ID = "bresser-5in1";
export const DEVICE_TYPE = "weather_station";

export function buildFeatureDefinitions(CATEGORIES, TYPES, UNITS) {
  return [
    {
      key: "temp_out",
      name: { en: "Outdoor temperature", fr: "Temperature exterieure" },
      category: CATEGORIES.SENSOR,
      type: TYPES.SENSOR.TEMPERATURE,
      unit: UNITS.CELSIUS,
      min: -40,
      max: 60,
    },
    {
      key: "hum_out",
      name: { en: "Outdoor humidity", fr: "Humidite exterieure" },
      category: CATEGORIES.SENSOR,
      type: TYPES.SENSOR.HUMIDITY,
      unit: UNITS.PERCENT,
      min: 0,
      max: 100,
    },
    {
      key: "temp_in",
      name: { en: "Indoor temperature", fr: "Temperature interieure" },
      category: CATEGORIES.SENSOR,
      type: TYPES.SENSOR.TEMPERATURE,
      unit: UNITS.CELSIUS,
      min: -20,
      max: 60,
    },
    {
      key: "hum_in",
      name: { en: "Indoor humidity", fr: "Humidite interieure" },
      category: CATEGORIES.SENSOR,
      type: TYPES.SENSOR.HUMIDITY,
      unit: UNITS.PERCENT,
      min: 0,
      max: 100,
    },
    {
      key: "pressure",
      name: { en: "Atmospheric pressure", fr: "Pression atmospherique" },
      category: CATEGORIES.SENSOR,
      type: TYPES.SENSOR.PRESSURE,
      unit: UNITS.HPA,
      min: 900,
      max: 1100,
    },
    {
      key: "wind_speed",
      name: { en: "Wind speed", fr: "Vitesse du vent" },
      category: CATEGORIES.SENSOR,
      type: TYPES.SENSOR.WIND_SPEED,
      unit: UNITS.KMH,
      min: 0,
      max: 250,
    },
    {
      key: "wind_gust",
      name: { en: "Wind gust", fr: "Rafale de vent" },
      category: CATEGORIES.SENSOR,
      type: TYPES.SENSOR.WIND_SPEED,
      unit: UNITS.KMH,
      min: 0,
      max: 250,
    },
    {
      key: "wind_direction",
      name: { en: "Wind direction", fr: "Direction du vent" },
      category: CATEGORIES.SENSOR,
      type: TYPES.SENSOR.WIND_DIRECTION,
      unit: UNITS.DEGREE,
      min: 0,
      max: 360,
    },
    {
      key: "rain_rate",
      name: { en: "Rain rate", fr: "Intensite de pluie" },
      category: CATEGORIES.SENSOR,
      type: TYPES.SENSOR.RAIN,
      unit: UNITS.MM,
      min: 0,
      max: 500,
    },
    {
      key: "rain_daily",
      name: { en: "Daily rainfall", fr: "Pluie cumulee du jour" },
      category: CATEGORIES.SENSOR,
      type: TYPES.SENSOR.RAIN,
      unit: UNITS.MM,
      min: 0,
      max: 1000,
      keep_history: true,
    },
    {
      key: "battery_low",
      name: { en: "Outdoor sensor battery", fr: "Batterie capteur exterieur" },
      category: CATEGORIES.BATTERY,
      type: TYPES.BATTERY.BINARY,
      min: 0,
      max: 1,
    },
  ];
}

export function buildDiscoveredDevice(gladys, CATEGORIES, TYPES, UNITS) {
  const ids = gladys.externalIds(DEVICE_TYPE, STATION_PLATFORM_ID);
  const definitions = buildFeatureDefinitions(CATEGORIES, TYPES, UNITS);

  return {
    device: {
      name: "Station meteo Bresser",
      external_id: ids.device,
      features: definitions.map((def) => ({
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
      })),
    },
    ids,
    definitions,
  };
}
