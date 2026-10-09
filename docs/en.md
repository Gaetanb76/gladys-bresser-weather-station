# Bresser Weather Station for Gladys Assistant

This integration brings data from your **Bresser WSC Wi-Fi 5-in-1** weather station (or any other product built on the same Fine Offset hardware: Ecowitt, Froggit, Ambient Weather...) straight into Gladys Assistant, with no cloud service in between.

## What it does

- Outdoor temperature and humidity
- Indoor temperature and humidity (console)
- Atmospheric pressure
- Wind speed, gust and direction
- Rainfall (rate and daily total)
- Outdoor 5-in-1 sensor battery level
- A dashboard widget showing the current moon phase and a 30-day illumination chart (pure local astronomical calculation, no data from the station is needed for this)

## How it works

The integration starts a **companion container** ("ecowitt-receiver") exposed on a port Gladys allocates automatically. That is the port your station talks to directly, over HTTP, using the Ecowitt protocol, on your local network - no data ever goes through a cloud service.

## Requirements

- Gladys Assistant 5.1.0 or later.
- A Bresser (or Fine Offset-compatible) station with the **WSLink** or **WSView Plus** app, able to reach your Gladys instance on the local network.

## Setup

1. Install the integration from the Gladys catalog.
2. Open the **Configuration** tab: the "Connect your weather station" section shows the exact address and port to use (Gladys computes them for your installation).
3. In the WSLink / WSView Plus app, go to **Weather Services > Customized**:
   - Protocol Type: **Ecowitt**
   - Server IP / Hostname: the address shown in Gladys
   - Port: the port shown in Gladys
   - Path: `/data/report`
   - Upload Interval: 60 seconds
4. Save on the station. In Gladys, open the integration's **Discovery** tab and click "Create" on the "Bresser Weather Station" device.
5. Add the **Moon phase** widget from the dashboard editor (under the "Bresser Weather Station" section).

## Troubleshooting

- **No data coming in**: make sure the station and the machine running Gladys are on the same local network (or that the port is correctly forwarded if your Gladys install sits behind a router), and that the upload protocol configured on the station is Ecowitt, not Wunderground.
- **Battery always shows "OK"**: the 5-in-1 sensor only reports a low-battery flag below a certain threshold, never a continuous percentage.
- **Moon phase widget missing**: it requires Gladys 5.1.0 or later.

## Support

Open an issue on the integration's GitHub repository, or ask on the Gladys Assistant community forum.
