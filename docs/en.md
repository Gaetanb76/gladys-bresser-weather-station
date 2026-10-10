# Bresser Weather Station for Gladys Assistant

Brings your **Bresser 7002580 WiFi colour station (5-in-1)** into Gladys Assistant, plus a moon-phase widget.

## What it provides

- Outdoor temperature, humidity, dew point
- Indoor temperature and humidity
- Atmospheric pressure
- Wind speed, gust and direction
- Rain (last hour, daily total)
- Dashboard widget: moon phase + 30-day illumination chart (local calculation)

The station's upload protocol carries **no battery information**, so no battery feature is provided.

## How it works

The console can only upload to Weather Underground (HTTP) or Weathercloud. This integration runs a companion container that speaks the Weather Underground upload protocol. A small relay on your network (e.g. a Raspberry Pi with dnsmasq + nginx, see the `relay/` folder of the repository) redirects `rtupdate.wunderground.com` and sends a copy of each upload to that container. Your Wunderground page keeps working.

## Setup

1. Install the integration in Gladys; note the address/port shown in Configuration.
2. Set up the relay (`relay/README.md`).
3. Make sure the station is configured for Weather Underground (Pro Weather Link page, `http://192.168.1.1` when connected to the `PWS-xxxxxx` WiFi).
4. Open the Discovery tab and create the "Station météo Bresser" device.
5. Add the **Moon phase** widget to a dashboard.

## Troubleshooting

- No data: check the relay (`curl` test in `relay/README.md`) and that the Pi is the DNS server of the station.
- Pressure is the station's value converted from inHg (absolute/relative depends on the station's setting).
- "Rain (last hour)" is the `rainin` value sent by the station.
