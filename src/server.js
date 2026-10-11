// HTTP endpoint that receives the Wunderground-protocol upload.
// Kept free of any Gladys dependency so it can be tested on its own.

import http from "node:http";
import { parseWundergroundQuery } from "./wunderground.js";
import { createChangePublisher } from "./publisher.js";

/**
 * @param {{ ids: { feature(key: string): string },
 *           publishStates(states: object[]): Promise<unknown>,
 *           logger?: { debug(...a: unknown[]): void, error(...a: unknown[]): void } }} deps
 */
export function createReceiver({ ids, publishStates, logger = console }) {
  const publisher = createChangePublisher({ ids, publishStates });

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
      const count = await publisher.publish(readings);
      if (count > 0) logger.debug(`Published ${count} changed state(s)`);
      // What Weather Underground itself answers to a successful upload.
      res.writeHead(200, { "Content-Type": "text/plain" }).end("success\n");
    } catch (err) {
      logger.error("Failed to publish states", err);
      res.writeHead(500).end("error\n");
    }
  });
}
