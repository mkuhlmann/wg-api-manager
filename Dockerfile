FROM oven/bun:1.2.2-debian AS build-stage

WORKDIR /build

COPY ./package.json /build
COPY ./bun.lock /build
COPY ./packages/app/package.json /build/packages/app/
COPY ./packages/server/package.json /build/packages/server/

RUN bun install --frozen-lockfile
COPY . /build

RUN bun run --cwd ./packages/app build-only

FROM oven/bun:1.2.2-alpine

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


COPY ./package.json /app
COPY ./bun.lock /app
COPY ./packages/server/package.json /app/packages/server/
 
RUN bun install --frozen-lockfile

COPY ./packages/server /app/packages/server
COPY --from=build-stage /build/packages/app/dist /app/packages/app/dist

USER root


EXPOSE 51820/udp
EXPOSE 3000/tcp

CMD ["bun", "start"]