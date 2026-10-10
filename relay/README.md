# Relay on the Raspberry Pi

1. `sudo apt install dnsmasq nginx`
2. dnsmasq: forward everything to 1.1.1.1 / 9.9.9.9 and add only
   `address=/rtupdate.wunderground.com/<PI_IP>` (and `weatherstation.wunderground.com`).
   Do NOT override `api.weathercloud.net` - leave Weathercloud untouched.
3. Router (Deco): set the Pi as DNS server in the DHCP settings.
4. Copy `bresser-relay.conf` to `/etc/nginx/conf.d/`, fill in GLADYS_IP / GLADYS_PORT,
   then `sudo nginx -t && sudo systemctl reload nginx`.
5. Test: `curl "http://<PI_IP>/weatherstation/updateweatherstation.php?tempf=60&humidity=50" -H "Host: rtupdate.wunderground.com"`
   and check that Gladys receives values.
