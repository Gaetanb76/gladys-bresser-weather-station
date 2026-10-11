# Relay (only for "relay" mode)

The relay makes the station's own upload reach Gladys. It needs two things, on
a machine that is always on: a DNS answer that points `rtupdate.wunderground.com`
to that machine, and a small web server (nginx) that forwards each upload to
the real Weather Underground **and** to the integration.

Pick one:

## A. On the machine that hosts Gladys (Docker Compose)

Requirements: Docker + Compose, ports 53 and 80 free on the LAN IP
(on Ubuntu, systemd-resolved only listens on 127.0.0.53, so it does not clash).

```bash
cd relay
cp .env.example .env && nano .env      # LAN_IP and GLADYS_PORT
docker compose up -d --build
```

## B. On a Raspberry Pi (or any other small Linux box)

1. `sudo apt install dnsmasq nginx`
2. dnsmasq: forward everything to 1.1.1.1 / 9.9.9.9 and add only
   `address=/rtupdate.wunderground.com/<PI_IP>` and `address=/weatherstation.wunderground.com/<PI_IP>`.
3. Copy `bresser-relay.conf` to `/etc/nginx/conf.d/`, replace GLADYS_IP / GLADYS_PORT,
   then `sudo nginx -t && sudo systemctl reload nginx`.

## Then, in both cases

- In your router (Deco: More > Advanced > DHCP Server > DNS) set the relay machine as DNS server,
  ideally with a public resolver (e.g. 1.1.1.1) as secondary so the network keeps working if it is off.
  The Livebox alone cannot do this: put another router in router mode behind it, or set the DNS per device.
- Do NOT override `api.weathercloud.net`.
- Test: `curl "http://<RELAY_IP>/weatherstation/updateweatherstation.php?tempf=60&humidity=50" -H "Host: rtupdate.wunderground.com"`
