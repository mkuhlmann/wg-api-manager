# wg-api-manager

> ℹ️ **This project is still in development but useable.**

I created this project to manage an automated large scale wireguard vpn for thin clients in multiple locations. I also needed support for multiple wireguard servers, which as far as I know no other project supports. The project is primarily designed to be used with an api, but also provides a simple ui for managing configurations. I already use wg-api-manager in production use, but keep in mind it is still in development, opinionated, lacks testing and documention. I am happy about any feedback or pull-requests.

## Features

- Create and manage **multiple** WireGuard VPN configurations
- **No complex environment variables or configuration files**
- Automated ip allocation based on CIDR-subnet
- Supports multiple servers and endpoints
- Primarily designed to use api
- Optionally provides simple ui for managing configurations
- Automatically generate client configurations (including QR codes)
- Restricted clients: put peers in groups and control what each group can reach, enforced server-side with nftables (see [Restricted Clients](#restricted-clients) below)
- Redirect traffic through the VPN, including full internet egress, per group
- Traffic stats
- Authenticated with administration, server and peer token

## Planned Features

- Desktop client
- Perspectively sso (openid connect)

## Installation

### 1. Generate Adminstration Token

Generate an unique and cryptographically secure administration token.

```bash
openssl rand -base64 32
```

> ℹ️ if no token is provided (or is too short), a random token will be generated on startup and printed to the console.

### 2. Run wg-api-manager

wg-api-manager stores a sqlite database in the `/app/data` directory. Make sure to mount a volume to persist the database.

For the WireGuard VPN to work, the container needs the `NET_ADMIN` and `SYS_MODULE` capabilities. Additionally, the following sysctl settings are required:

```bash
sysctl 'net.ipv4.conf.all.src_valid_mark=1'
sysctl 'net.ipv4.ip_forward=1'
```

For production use, it is recommended to use a reverse proxy like Traefik to handle SSL termination.

#### Via docker run

```bash
docker run -d \
  --name wg-api-manager \
  --env ADMIN_TOKEN=(openssl rand -base64 32) \
  --volume ./wg-data:/app/data \
  --publish 51820:51820/udp \
  --publish 3000:3000/tcp \
  --cap-add NET_ADMIN \
  --cap-add SYS_MODULE \
  --sysctl 'net.ipv4.conf.all.src_valid_mark=1' \
  --sysctl 'net.ipv4.ip_forward=1' \
  --restart unless-stopped \
  ghcr.io/mkuhlmann/wg-api-manager:latest
```

#### Via docker-compose

Download the `docker-compose.yml` file from the repository and adjust the environment variables as needed.

```bash
wget https://raw.githubusercontent.com/mkuhlmann/wg-api-manager/main/docker-compose.yml
```

```bash
docker-compose up -d
```

## Restricted Clients

By default every peer on a server can reach every other peer - this is unchanged, and any peer you never assign
to a group keeps behaving exactly this way.

To restrict a peer, put it in a **group**, then define what that group is allowed to reach:

- another **group** (directional - "office can reach db" doesn't imply "db can reach office"; a group needs an
  explicit rule to itself before its own members can reach each other)
- an arbitrary **subnet/CIDR** - useful for a site-to-site LAN behind the gateway
- the **server** itself (its own tunnel address - dns, the management api)
- the **internet** - also requires `enableNat` to be turned on for that server, since this masquerades the
  group's traffic on the way out. Off by default; turning it on for a server does not by itself grant internet
  access to anyone - each group's "internet" grant is still required.

This is enforced with a generated nftables ruleset on the server, not by what a client's own config says it's
allowed to do - a client can't bypass it by editing its config. Manage groups and their reachability matrix from
the "policy" button on a server's page, or via the `/wg/servers/:id/groups` and
`/wg/servers/:id/groups/:groupId/rules` api endpoints.

## Testing

The server package has unit and integration tests (`bun run --cwd packages/server test`). The frontend
(`packages/app`) has no tests yet.
