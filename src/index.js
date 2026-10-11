// Main container entrypoint.
//
// Two ways to get the station's data into Gladys (setting "mode"):
//
//  - "wunderground_api": this process polls the Weather Underground API with
//    the station ID / API key from the settings. No network setup, but no
//    indoor values.
//  - "relay": the "wu-receiver" companion container (declared in the
//    manifest) receives the station's own upload, relayed on the local
//    network (see relay/). It gets this container's Gladys credentials via
//    env so it can publish states over its own SDK connection. Companion
//    containers are the only ones that get a host-published port.

import { GladysIntegration, DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES, DEVICE_FEATURE_UNITS, logger } from "@gladysassistant/integration-sdk";
import { buildDiscoveredDevice, DEVICE_TYPE, STATION_PLATFORM_ID } from "./device.js";
import { getMoonPhase, buildIlluminationSeries } from "./moon.js";
import { fetchObservation } from "./wuapi.js";
import { createChangePublisher } from "./publisher.js";

const gladys = new GladysIntegration();
const ids = gladys.externalIds(DEVICE_TYPE, STATION_PLATFORM_ID);
const publisher = createChangePublisher({ ids, publishStates: (states) => gladys.publishStates(states) });

const MODE_RELAY = "relay";
let pollTimer = null;
let currentSettings = { mode: "wunderground_api" };

function readSettings(config) {
  const minutes = Number(config.poll_minutes);
  return {
    mode: config.mode === MODE_RELAY ? MODE_RELAY : "wunderground_api",
    stationId: String(config.wu_station_id ?? "").trim(),
    apiKey: String(config.wu_api_key ?? "").trim(),
    pollMinutes: Number.isFinite(minutes) ? Math.min(60, Math.max(2, minutes)) : 5,
  };
}

// --- Discovery -----------------------------------------------------------

gladys.onScanRequest(async () => {
  const { device } = buildDiscoveredDevice(gladys, DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES, DEVICE_FEATURE_UNITS, {
    indoor: currentSettings.mode === MODE_RELAY,
  });
  await gladys.publishDiscoveredDevices([device]);
});

// --- Moon phase widget ---------------------------------------------------
// Pure calendar astronomy: no dependency on the weather station at all.

gladys.onWidgetGet("moon_phase", async () => {
  const now = new Date();
  const { illuminationPercent, phaseName } = getMoonPhase(now);
  const series = buildIlluminationSeries(now);

  return {
    ttl_seconds: 3600,
    components: [
      { type: "text", variant: "caption", text: { en: "Moon phase", fr: "Phase de la lune" } },
      { type: "value", value: illuminationPercent, unit: "%", label: phaseName, icon: "moon", color: "info" },
      {
        type: "chart",
        chart_type: "area",
        unit: "%",
        now_marker: true,
        series: [{ label: { en: "Illumination", fr: "Illumination" }, points: series }],
      },
      {
        type: "text",
        variant: "caption",
        text: {
          en: `Today: ${phaseName.en} (${illuminationPercent}% illuminated)`,
          fr: `Aujourd'hui : ${phaseName.fr} (${illuminationPercent}% d'illumination)`,
        },
      },
    ],
  };
});

// --- Mode: Wunderground API polling -------------------------------------

async function pollOnce(settings) {
  try {
    const readings = await fetchObservation(settings.stationId, settings.apiKey);
    const count = await publisher.publish(readings);
    logger.debug(`Wunderground API: ${Object.keys(readings).length} value(s), ${count} changed`);
  } catch (err) {
    // err.message never contains the API key (see wuapi.js)
    logger.error(`Wunderground API poll failed: ${err.message}`);
  }
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function startPolling(settings) {
  stopPolling();
  if (!settings.stationId || !settings.apiKey) {
    logger.warn("Wunderground API mode: station ID and API key are required in the settings");
    return;
  }
  logger.info(`Polling Wunderground every ${settings.pollMinutes} min`);
  pollOnce(settings);
  pollTimer = setInterval(() => pollOnce(settings), settings.pollMinutes * 60_000);
}

// --- Mode: relay (companion container) ----------------------------------

async function startReceiver() {
  try {
    await gladys.startContainer("wu-receiver", {
      env: {
        GLADYS_HOST_API_URL: process.env.GLADYS_HOST_API_URL,
        GLADYS_INTEGRATION_TOKEN: process.env.GLADYS_INTEGRATION_TOKEN,
        GLADYS_INTEGRATION_SELECTOR: process.env.GLADYS_INTEGRATION_SELECTOR,
        TZ: process.env.TZ,
      },
    });
    logger.info("wu-receiver container started");
  } catch (err) {
    logger.error("Could not start wu-receiver container", err);
  }
}

async function stopReceiver() {
  try {
    await gladys.stopContainer("wu-receiver");
  } catch {
    // not created yet / already stopped: nothing to do
  }
}

// --- Apply settings ------------------------------------------------------

async function applySettings(config) {
  currentSettings = readSettings(config);
  if (currentSettings.mode === MODE_RELAY) {
    stopPolling();
    await startReceiver();
  } else {
    await stopReceiver();
    startPolling(currentSettings);
  }
}

gladys.onConfigUpdated(async (config) => {
  await applySettings(config);
});

gladys.handleShutdown(() => stopPolling());

await gladys.connect();
await applySettings(await gladys.getConfig());
