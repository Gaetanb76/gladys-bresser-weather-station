// Companion container entrypoint ("ecowitt-receiver" in the manifest).
//
// This is the process the Bresser station actually talks to: it listens
// on the host-published port (manifest: containers[0].ports[0], name
// "ecowitt") for the Ecowitt-protocol HTTP POST the WSLink / WSView Plus
// app sends on a schedule, converts the payload to metric, and publishes
// the changed values straight to Gladys using its OWN SDK connection -
// authenticated with the GLADYS_* env vars forwarded to it by the main
// container at startup (see src/index.js: startReceiver()).
//
// It never needs to know about the main container at all: external_id
// strings are computed the same deterministic way on both sides (see
// src/device.js), so publishState() here lands on exactly the features
// the main container declared during discovery.

import http from "node:http";
import { GladysIntegration, logger } from "@gladysassistant/integration-sdk";
import { parseEcowittPayload } from "./ecowitt.js";
import { DEVICE_TYPE, STATION_PLATFORM_ID } from "./device.js";

const PORT = Number(process.env.RECEIVER_PORT || 8080);
const ENDPOINT = "/data/report";

const gladys = new GladysIntegration();
const ids = gladys.externalIds(DEVICE_TYPE, STATION_PLATFORM_ID);

// Gladys limits state updates to 300/minute per integration: only publish
// values that actually changed since the last upload.
const lastValues = new Map();

function buildChangedStates(readings) {
  const states = [];
  for (const [key, value] of Object.entries(readings)) {
    if (value === null) continue;
    const featureId = ids.feature(key);
    if (lastValues.get(featureId) === value) continue;
    lastValues.set(featureId, value);
    states.push({ device_feature_external_id: featureId, state: value });
  }
  return states;
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || !req.url.startsWith(ENDPOINT)) {
    res.writeHead(404).end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    // Basic guard against a misbehaving / malicious sender.
    if (body.length > 1_000_000) req.destroy();
  });

  req.on("end", async () => {
    try {
      const readings = parseEcowittPayload(body);
      const states = buildChangedStates(readings);
      if (states.length > 0) {
        await gladys.publishStates(states);
        logger.debug(`Published ${states.length} changed state(s)`);
      }
      res.writeHead(200, { "Content-Type": "text/plain" }).end("OK");
    } catch (err) {
      logger.error("Failed to process Ecowitt upload", err);
      res.writeHead(500).end("Error");
    }
  });
});

gladys.handleShutdown(() => {
  server.close();
});

await gladys.connect();

server.listen(PORT, () => {
  logger.info(`Ecowitt receiver listening on port ${PORT}, endpoint ${ENDPOINT}`);
});
