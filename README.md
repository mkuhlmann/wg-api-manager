# wg-api-manager

ℹ️ **This project is still in development but useable.**

I created this project to manage an automated large scale wireguard vpn for thin clients in multiple locations. I also needed support for multiple wireguard servers, which as far as I know no other project supports. The project is primarily designed to be used with an api, but also provides a simple ui for managing configurations. I already use wg-api-manager in production use, but keep in mind it is still in development, opinionated, lacks testing and documention. I am happy about any feedback or pull-requests.

## Features

-   Create and manage **multiple** WireGuard VPN configurations
-   **No complex environment variables or configuration files**
-   Automated ip allocation based on CIDR-subnet
-   Supports multiple servers and endpoints
-   Primarily designed to use api
-   Optionally provides simple ui for managing configurations
-   Automatically generate client configurations (including QR codes)
-   Traffic stats
-   Authenticated with administration, server and peer token

## Planned Features

-   Redirect traffic through VPN
-   Testing still missing completely
-   Desktop client
-   Perspectively sso (openid connect)

## Installation

### 1. Generate Adminstration Token

Generate an unique and cryptographically secure administration token.

```bash
openssl rand -base64 32
```

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
