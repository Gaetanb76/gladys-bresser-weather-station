// Companion container entrypoint ("wu-receiver" in the manifest).
//
// Receives the Weather Underground upload that the Bresser console sends
// (relayed to this container's published port, see relay/), converts it to
// metric and writes the latest values to the shared folder. It has NO
// Gladys credentials: the main container reads the file and publishes.

import fs from "node:fs/promises";
import path from "node:path";
import { createReceiver } from "./server.js";
import { RECEIVER_SHARED_DIR, LATEST_FILE } from "./shared.js";

const PORT = Number(process.env.RECEIVER_PORT || 8080);
const dir = process.env.SHARED_DIR || RECEIVER_SHARED_DIR;
const file = path.join(dir, LATEST_FILE);

let latest = {};
let lastWritten = "";

async function onReadings(readings) {
  latest = { ...latest, ...readings };
  const body = JSON.stringify({ updated: new Date().toISOString(), readings: latest });
  // Skip the write when nothing changed (the console uploads every ~12 s)
  const signature = JSON.stringify(latest);
  if (signature === lastWritten) return;
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, body);
  await fs.rename(tmp, file); // atomic: the reader never sees a half-written file
  lastWritten = signature;
}

await fs.mkdir(dir, { recursive: true });

const server = createReceiver({ onReadings });
server.listen(PORT, () => console.log(`Wunderground receiver listening on port ${PORT}, writing to ${file}`));

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
