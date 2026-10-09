# gladys-bresser-weather-station

External integration for **Gladys Assistant** that brings a Bresser 5-in-1 WiFi
weather station (Fine Offset / Ecowitt-protocol hardware) into Gladys, plus a
moon-phase dashboard widget. See `docs/en.md` / `docs/fr.md` for the
end-user guide, and the comments in `src/` for how it's wired together.

## Architecture in short

```
Bresser station (WSLink/WSView Plus)
      |  HTTP POST, Ecowitt protocol
      v
companion container "ecowitt-receiver" (src/receiver.js)
      |  parses + converts to metric, calls its own Gladys SDK connection
      v
Gladys core  <----------------------------  main container (src/index.js)
                                              - device discovery
                                              - moon phase widget
                                              - starts/supervises the
                                                companion container
```

Both containers are built from this same image; the manifest's
`containers[0].command` overrides the entrypoint for the companion one.
They never talk to each other directly - the main container forwards its
own `GLADYS_HOST_API_URL` / `GLADYS_INTEGRATION_TOKEN` /
`GLADYS_INTEGRATION_SELECTOR` to the companion container's env at startup,
so the companion can open an independent, fully authenticated SDK
connection and publish states straight to Gladys.

## Local development

```bash
npm install

# Main process, against a Gladys instance in developer mode:
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="my-integration" \
LOG_LEVEL=debug \
npm start

# Receiver process (needs the same three vars):
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="my-integration" \
RECEIVER_PORT=8080 \
npm run receiver
```

Point the station (or `curl`) at `http://localhost:8080/data/report` with a
sample Ecowitt-style body to test end to end, e.g.:

```bash
curl -X POST http://localhost:8080/data/report \
  --data "tempf=68.0&humidity=55&tempinf=71.0&humidityin=48&baromabsin=29.92&windspeedmph=5&winddir=180&rainratein=0&dailyrainin=0.1&wh65batt=0"
```

## Build

```bash
docker build -t ghcr.io/yourname/gladys-bresser-weather-station:1.0.0 .
```

Validate the manifest before publishing:

```bash
npx github:GladysAssistant/integration-store .
```

## Publish

1. Add the GitHub topic `gladys-assistant-integration` to this repository.
2. Run the **Release** workflow from the Actions tab (pick `patch`,
   `minor` or `major`). It bumps the version, tags, builds multi-arch
   images and pushes them to `ghcr.io`. Make sure the `ghcr.io` package
   is set to public afterwards.

The Gladys store indexer picks up public repos tagged
`gladys-assistant-integration` automatically within the hour.

## Before you ship this for real

A couple of things worth double-checking against your actual Gladys
version before relying on this in production:

- **Feature catalog names.** `src/device.js` uses
  `DEVICE_FEATURE_CATEGORIES.SENSOR` / `DEVICE_FEATURE_TYPES.SENSOR.*` /
  `DEVICE_FEATURE_UNITS.*` constant names that match Gladys' public
  device-feature catalog as of writing. Run
  `node -e "console.log(require('@gladysassistant/integration-sdk').DEVICE_FEATURE_TYPES.SENSOR)"`
  after `npm install` and adjust any name that doesn't match (particularly
  `WIND_SPEED`, `WIND_DIRECTION`, `RAIN`, `PRESSURE`, and the
  `BATTERY.BINARY` type).
- **`gladys.startContainer` env forwarding.** The doc excerpt available
  while building this confirms `startContainer(name, { env })` exists but
  doesn't enumerate which env keys are safe/allowed to forward. If Gladys
  rejects or strips `GLADYS_*` keys passed this way, the fallback is to
  give the companion container its own independent install flow (a
  `config_schema` field holding a one-time pairing token) instead of
  forwarding the main container's credentials.
- `npx github:GladysAssistant/integration-store .` is the authoritative
  check - run it before every release.
