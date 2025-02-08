FROM oven/bun:1.2.2-debian AS build-stage

WORKDIR /build

COPY ./package.json /build
COPY ./bun.lock /build
COPY ./packages/app/package.json /build/packages/app/
COPY ./packages/server/package.json /build/packages/server/

RUN bun install --frozen-lockfile
COPY . /build

RUN bun run --cwd ./packages/app build-only
RUN bun run --cwd ./packages/server build

FROM oven/bun:1.2.2-alpine

RUN apk add --no-cache \
    coredns \
    iptables \
    iputils \
    libcap-utils \
    net-tools \
    openresolv \
    wireguard-tools \
    supervisor

WORKDIR /app

COPY --from=build-stage /build/packages/server/dist /app/packages/server/dist
COPY --from=build-stage /build/packages/server/drizzle /app/packages/server/drizzle
COPY --from=build-stage /build/packages/app/dist /app/packages/app/dist

USER root


EXPOSE 51820/udp
EXPOSE 3000/tcp

COPY supervisord.conf /etc/supervisord.conf
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]