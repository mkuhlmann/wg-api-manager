FROM oven/bun:1.1.43-alpine

RUN apk add --no-cache \
    coredns \
    iptables \
    iputils \
    libcap-utils \
    net-tools \
    openresolv \
    wireguard-tools

COPY . /app
WORKDIR /app

EXPOSE 51820/udp
EXPOSE 3000/tcp

CMD ["bun", "start"]