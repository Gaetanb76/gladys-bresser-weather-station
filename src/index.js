// Main container entrypoint.
//
// Responsibilities:
//  1. Talk to Gladys over the SDK (discovery, config, the moon phase widget).
//  2. Start the "wunderground-receiver" companion container (declared in
//     gladys-assistant-integration.json), forwarding this container's own
//     Gladys credentials to it as env vars so it can open its own SDK
//     connection and publish weather states directly - no networking
//     between the two containers is required.
//
// The main container never talks HTTP to the weather station itself: that
// job belongs to the companion container, because only companion
// containers get a host-published port the station can reach on the LAN.

import { GladysIntegration, DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES, DEVICE_FEATURE_UNITS, logger } from "@gladysassistant/integration-sdk";
import { buildDiscoveredDevice } from "./device.js";
import { getMoonPhase, buildIlluminationSeries } from "./moon.js";

const gladys = new GladysIntegration();

gladys.onScanRequest(async () => {
  const { device } = buildDiscoveredDevice(gladys, DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES, DEVICE_FEATURE_UNITS);
  await gladys.publishDiscoveredDevices([device]);
});

gladys.onConfigUpdated(async (config) => {
  logger.info("Configuration updated", config);
});

// --- Moon phase widget -----------------------------------------------
// Pure calendar astronomy: no dependency on the weather station at all.

gladys.onWidgetGet("moon_phase", async ({ language }) => {
  const now = new Date();
  const { illuminationPercent, phaseName, phaseKey } = getMoonPhase(now);
  const series = buildIlluminationSeries(now);
  const lang = language === "fr" ? "fr" : "en";

  return {
    ttl_seconds: 3600,
    components: [
      { type: "text", variant: "caption", text: { en: "Moon phase", fr: "Phase de la lune" } },
      {
        type: "value",
        value: illuminationPercent,
        unit: "%",
        label: phaseName,
        icon: "moon",
        color: "info",
      },
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

// --- Companion container lifecycle ------------------------------------

async function startReceiver() {
  try {
    await gladys.startContainer("wunderground-receiver", {
      env: {
        GLADYS_HOST_API_URL: process.env.GLADYS_HOST_API_URL,
        GLADYS_INTEGRATION_TOKEN: process.env.GLADYS_INTEGRATION_TOKEN,
        GLADYS_INTEGRATION_SELECTOR: process.env.GLADYS_INTEGRATION_SELECTOR,
        TZ: process.env.TZ,
      },
    });
    logger.info("wunderground-receiver container started");
  } catch (err) {
    logger.error("Could not start wunderground-receiver container", err);
  }
}

gladys.handleShutdown();

await gladys.connect();
await startReceiver();

// Re-assert the companion container is running after every reconnect
// (covers the case where Gladys restarted this container but the
// companion was separately stopped for some reason).
gladys.on?.("connected", () => {
  startReceiver();
});
