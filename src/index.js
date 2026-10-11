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
import { getMoonPhase, getNextMoonEvents } from "./moon.js";
import { renderMoonPng } from "./moonImage.js";
import { createHouseLookup } from "./house.js";
import { fetchObservation } from "./wuapi.js";
import { createChangePublisher } from "./publisher.js";
import { RECEIVER_NAME, MAIN_SHARED_DIR, LATEST_FILE } from "./shared.js";

const gladys = new GladysIntegration();
const ids = gladys.externalIds(DEVICE_TYPE, STATION_PLATFORM_ID);
const publisher = createChangePublisher({ ids, publishStates: (states) => gladys.publishStates(states) });
const houses = createHouseLookup(gladys);

const MODE_RELAY = "relay";
let pollTimer = null;
let currentSettings = { mode: "wunderground_api", houseName: "" };

function readSettings(config) {
  const minutes = Number(config.poll_minutes);
  return {
    mode: config.mode === MODE_RELAY ? MODE_RELAY : "wunderground_api",
    stationId: String(config.wu_station_id ?? "").trim(),
    apiKey: String(config.wu_api_key ?? "").trim(),
    pollMinutes: Number.isFinite(minutes) ? Math.min(60, Math.max(2, minutes)) : 5,
    houseName: String(config.house_name ?? "").trim(),
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

// The picture is quantized to MOON_IMAGE_STEPS images per cycle (about one
// every 3.5 hours): the core caches an image one hour by key, so the key
// carries the step and changes when the picture does.
// The hemisphere (n/s) is part of the key too: it mirrors the picture.
const MOON_IMAGE_STEPS = 200;
const MOON_IMAGE_KEY = /^moon-([ns])-(\d{1,3})$/;
const moonImageCache = new Map();

gladys.onWidgetGet("moon_phase", async ({ language } = {}) => {
  const now = new Date();
  const { phase, illuminationPercent, phaseName } = getMoonPhase(now);
  const { nextNewMoon, nextFullMoon } = getNextMoonEvents(now);
  const step = Math.round(phase * MOON_IMAGE_STEPS) % MOON_IMAGE_STEPS;
  const { house, count } = await houses.get(currentSettings.houseName);
  const hemisphere = house && house.latitude < 0 ? "s" : "n";
  const lang = language === "fr" ? "fr" : "en";
  const formatDate = (d) =>
    d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "long" });

  // Canonical card order: header text, then the picture (focal), then the
  // status rows - so the phase name sits right under the moon.
  return {
    ttl_seconds: 3600,
    components: [
      { type: "text", variant: "caption", text: { en: "Moon phase", fr: "Phase de la lune" } },
      { type: "image", key: `moon-${hemisphere}-${step}`, fit: "contain", alt: phaseName },
      {
        type: "status",
        items: [
          { label: { en: "Phase", fr: "Phase" }, value: phaseName[lang], icon: "moon", color: "info" },
          { label: { en: "Illumination", fr: "Illumination" }, value: `${illuminationPercent} %`, color: "neutral" },
          { label: { en: "Next full moon", fr: "Prochaine pleine lune" }, value: formatDate(nextFullMoon), color: "neutral" },
          { label: { en: "Next new moon", fr: "Prochaine nouvelle lune" }, value: formatDate(nextNewMoon), color: "neutral" },
          // With several houses, say which one the moon is seen from (its name, never its coordinates).
          ...(count > 1 ? [{ label: { en: "House", fr: "Maison" }, value: house.name, icon: "home", color: "neutral" }] : []),
        ],
      },
    ],
  };
});

gladys.onWidgetGetImage(async (imageKey) => {
  const match = MOON_IMAGE_KEY.exec(imageKey);
  if (!match) throw new Error(`Unknown widget image: ${imageKey}`);
  if (!moonImageCache.has(imageKey)) {
    if (moonImageCache.size >= 8) moonImageCache.delete(moonImageCache.keys().next().value);
    const png = renderMoonPng(Number(match[2]) / MOON_IMAGE_STEPS, { southern: match[1] === "s" });
    moonImageCache.set(imageKey, png.toString("base64"));
  }
  return moonImageCache.get(imageKey);
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
  // the house may have changed (or just been located): redraw the moon
  houses.invalidate();
  gladys.requestWidgetRefresh("moon_phase");
});

gladys.handleShutdown(() => {
  stopPolling();
  stopFileWatch();
});

await gladys.connect();
await applySettings(await gladys.getConfig());
