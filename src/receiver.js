// Companion container entrypoint ("wunderground-receiver" in the manifest).
//
// Receives the Weather Underground upload that the Bresser console sends
// (relayed to this container's published port by the network relay - see
// docs/relay.md), converts it to metric and publishes the changed values to
// Gladys over its OWN SDK connection, authenticated with the GLADYS_* env vars
// forwarded by the main container (src/index.js: startReceiver()).

import { GladysIntegration, logger } from "@gladysassistant/integration-sdk";
import { DEVICE_TYPE, STATION_PLATFORM_ID } from "./device.js";
import { createReceiver } from "./server.js";

const PORT = Number(process.env.RECEIVER_PORT || 8080);

const gladys = new GladysIntegration();
const ids = gladys.externalIds(DEVICE_TYPE, STATION_PLATFORM_ID);

const server = createReceiver({
  ids,
  publishStates: (states) => gladys.publishStates(states),
  logger,
});

gladys.handleShutdown(() => {
  server.close();
});

await gladys.connect();

server.listen(PORT, () => {
  logger.info(`Wunderground receiver listening on port ${PORT}`);
});
