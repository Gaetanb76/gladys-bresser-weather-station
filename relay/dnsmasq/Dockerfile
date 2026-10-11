FROM alpine:3.20
RUN apk add --no-cache dnsmasq
# Answers every name normally (forwarded to public resolvers) except the two
# Weather Underground upload hosts, which point to this machine.
CMD ["sh", "-c", "exec dnsmasq -k --no-resolv --no-hosts --server=1.1.1.1 --server=9.9.9.9 --listen-address=$LAN_IP --bind-interfaces --address=/rtupdate.wunderground.com/$LAN_IP --address=/weatherstation.wunderground.com/$LAN_IP"]
