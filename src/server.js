// HTTP endpoint that receives the Wunderground-protocol upload.
// Free of any Gladys dependency so it can be tested on its own.

import http from "node:http";
import { parseWundergroundQuery } from "./wunderground.js";

/**
 * @param {{ onReadings(readings: Record<string, number>): Promise<void>|void,
 *           logger?: { debug(...a: unknown[]): void, error(...a: unknown[]): void } }} deps
 */
export function createReceiver({ onReadings, logger = console }) {
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
      await onReadings(readings);
      // What Weather Underground itself answers to a successful upload.
      res.writeHead(200, { "Content-Type": "text/plain" }).end("success\n");
    } catch (err) {
      logger.error("Failed to store readings:", err.message);
      res.writeHead(500).end("error\n");
    }
  });
}
