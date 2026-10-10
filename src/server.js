// HTTP endpoint that receives the Wunderground-protocol upload.
// Kept free of any Gladys dependency so it can be tested on its own.

import http from "node:http";
import { parseWundergroundQuery } from "./wunderground.js";

/**
 * @param {{ ids: { feature(key: string): string },
 *           publishStates(states: object[]): Promise<unknown>,
 *           logger?: { debug(...a: unknown[]): void, error(...a: unknown[]): void } }} deps
 */
export function createReceiver({ ids, publishStates, logger = console }) {
  // Gladys limits state updates (300/min per integration) and the console
  // uploads every ~12 s: only publish values that changed.
  const lastValues = new Map();

  function changedStates(readings) {
    const states = [];
    for (const [key, value] of Object.entries(readings)) {
      const featureId = ids.feature(key);
      if (lastValues.get(featureId) === value) continue;
      lastValues.set(featureId, value);
      states.push({ device_feature_external_id: featureId, state: value });
    }
    return states;
  }

  return http.createServer(async (req, res) => {
    // The URL is never logged: it carries the Wunderground station key.
    const url = new URL(req.url, "http://localhost");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    const readings = parseWundergroundQuery(url.searchParams);
    if (Object.keys(readings).length === 0) {
      res.writeHead(404).end();
      return;
    }
    try {
      const states = changedStates(readings);
      if (states.length > 0) {
        await publishStates(states);
        logger.debug(`Published ${states.length} changed state(s)`);
      }
      // What Weather Underground itself answers to a successful upload.
      res.writeHead(200, { "Content-Type": "text/plain" }).end("success\n");
    } catch (err) {
      // Forget cached values so the next upload retries them.
      lastValues.clear();
      logger.error("Failed to publish states", err);
      res.writeHead(500).end("error\n");
    }
  });
}
