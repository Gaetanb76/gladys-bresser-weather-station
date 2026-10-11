// Main container entrypoint.
//
// Two ways to get the station's data into Gladys (setting "mode"):
//
//  - "wunderground_api": this process polls the Weather Underground API with
//    the station ID / API key from the settings. No network setup, but no
//    indoor values.
//  - "relay": the "wu-receiver" companion container (declared in the
//    manifest) receives the station's own upload, relayed on the local
//    network (see relay/), and writes it to a shared folder that this
//    process reads and publishes. Sub-containers get no Gladys credentials
//    but are the only ones with a host-published port.

import fs from "node:fs/promises";
import path from "node:path";
import { GladysIntegration, DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES, DEVICE_FEATURE_UNITS, logger } from "@gladysassistant/integration-sdk";
import { buildDiscoveredDevice, DEVICE_TYPE, STATION_PLATFORM_ID } from "./device.js";
import { getMoonPhase, buildIlluminationSeries } from "./moon.js";
import { fetchObservation } from "./wuapi.js";
import { createChangePublisher } from "./publisher.js";
import { RECEIVER_NAME, MAIN_SHARED_DIR, LATEST_FILE } from "./shared.js";

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
  const points = buildIlluminationSeries(now).map(({ x, y }) => ({
    t: new Date(now.getTime() + x * 86_400_000).toISOString(),
    v: y,
  }));

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
        series: [{ name: { en: "Illumination", fr: "Illumination" }, points }],
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
// The "wu-receiver" sub-container writes the latest readings to a shared
// folder (see shared.js); this process reads and publishes them.

let fileTimer = null;
let lastSeen = "";

async function readSharedOnce() {
  try {
    const raw = await fs.readFile(path.join(MAIN_SHARED_DIR, LATEST_FILE), "utf8");
    const { updated, readings } = JSON.parse(raw);
    if (updated === lastSeen) return;
    const count = await publisher.publish(readings ?? {});
    lastSeen = updated;
    logger.debug(`Relay: ${count} changed value(s) published`);
  } catch (err) {
    if (err.code !== "ENOENT") logger.error(`Could not read the receiver's data: ${err.message}`);
  }
}

function stopFileWatch() {
  if (fileTimer) clearInterval(fileTimer);
  fileTimer = null;
}

async function startReceiver() {
  try {
    await gladys.startContainer(RECEIVER_NAME);
    logger.info("wu-receiver container started");
  } catch (err) {
    logger.error(`Could not start wu-receiver container: ${err.message}`);
  }
  stopFileWatch();
  fileTimer = setInterval(readSharedOnce, 5000);
  readSharedOnce();
}

async function stopReceiver() {
  stopFileWatch();
  try {
    await gladys.stopContainer(RECEIVER_NAME);
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

gladys.handleShutdown(() => {
  stopPolling();
  stopFileWatch();
});

await gladys.connect();
await applySettings(await gladys.getConfig());
