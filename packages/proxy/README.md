# @lineage2js/proxy

WebSocket ⇄ TCP bridge for Lineage 2 servers that only speak raw TCP.

Browsers cannot open TCP sockets, so `@lineage2js/network` talks to the
login/game servers over a WebSocket (`ws://host:port`, see
`WebSocketAdapter`). Servers built for the retail client -- L2J, L2OFF,
lineage2ts, ... -- listen on plain TCP instead. This package sits in between:
it accepts the client's WebSocket connection, opens a TCP connection to the
real server, and relays bytes in both directions.

```
browser (@lineage2js/ui)          @lineage2js/proxy              L2 server
  ws://proxy:2106  ─────────────▶  WS listener :2106  ────────▶  tcp://server:2106  (login)
  ws://proxy:7777  ─────────────▶  WS listener :7777  ────────▶  tcp://server:7777  (game)
```

`server` is wherever the L2 server actually runs -- the same box as the proxy
(`127.0.0.1`), another host on the LAN, a container name, anything the proxy
can reach over TCP.

Nothing about the protocol is touched -- packets stay encrypted end to end
(Blowfish for login, XOR for game), the proxy never has the keys and never
needs them.

## Quick start

```bash
pnpm build:proxy
PROXY_ROUTES="2106=server:2106,7777=server:7777" pnpm start:proxy
```

or, with hot reload while working on it:

```bash
cp .env.example .env   # inside packages/proxy
pnpm dev:proxy --routes "2106=server:2106,7777=server:7777"
```

`server` is the L2 server's host or IP as seen *from the proxy*: `127.0.0.1`
when both run on the same machine, `10.0.0.5`, `l2-game.internal`, a docker
compose service name, ... A route can also be written as `2106=2106` or just
`2106`, which reuses `PROXY_TARGET_HOST` (`127.0.0.1` unless you change it).

`.env` is not read automatically (matching `packages/assets-server`) -- pass
it explicitly if you want it:

```bash
node --env-file=.env packages/proxy/dist/index.js
```

`--help` prints every flag and its env-var equivalent.

## Routing

### Static routes (what the UI client uses)

`PROXY_ROUTES` maps a listen port to a fixed TCP target: one listener per
entry, target decided at startup. The client is unaware a proxy exists, which
is what makes this the mode `@lineage2js/network` works with today.

The catch is the second hop. The client only connects to the login server
address it was configured with (`VITE_LOGIN_SERVER_IP` / `_PORT`); the game
server's address comes from the login server's own `ServerList` packet. So
**the address that ServerList advertises has to be a proxy port too**. A
typical layout:

| Where                 | What                                | Notes                                                    |
| --------------------- | ----------------------------------- | -------------------------------------------------------- |
| L2 login/game server   | `tcp://server:2106` / `tcp://server:7777` | wherever it runs; only the proxy needs to reach it  |
| proxy                  | `PROXY_ROUTES=2106=server:2106,7777=server:7777` | bound to `PROXY_HOST` (`0.0.0.0` by default) |
| client env             | `VITE_LOGIN_SERVER_IP/_PORT` = proxy's address:2106 | see `packages/ui/.env.example`      |
| L2 server's ServerList | proxy's address:7777                | configured in the L2 server, not here                     |

When the proxy shares a box with the L2 server, `server` is `127.0.0.1` and
the L2 server can stay bound to loopback while the proxy is the only thing
listening publicly. When they're on different hosts, `server` is that host --
just don't leave a raw TCP L2 port exposed that didn't need to be.

Listen and target ports don't have to match (`7777=server:7000` is fine), as
long as the port the client is told to use is the one the proxy listens on.

### Dynamic routes

`PROXY_DYNAMIC_PORT` opens one extra listener that takes its target from the
URL, so a single port can serve many servers:

```
ws://proxy:8080/server/7777          -> tcp://server:7777
ws://proxy:8080/?host=server&port=7777
```

Every request is checked against `PROXY_ALLOWED_TARGETS` (`host:port`,
`host:*`, or `*`), which is mandatory in this mode -- without it the proxy
would happily relay TCP to any host on the internet for anyone who can reach
it.

`@lineage2js/network` doesn't build these URLs yet (it derives the WebSocket
URL straight from `MMOConfig.Ip`/`Port`), so this mode is for custom clients
and dev tooling until that's wired up. Use static routes for the UI client.

## Packet framing

TCP is a byte stream with no message boundaries; WebSocket has them. Both L2
protocols prefix each packet with its length as a little-endian `uint16` that
includes the two length bytes, so with `PROXY_FRAMING=packet` (the default)
the proxy splits the stream on those boundaries and sends exactly one packet
per WebSocket message -- what the client would see from a native WebSocket
server.

`MMOClient.process()` re-assembles split packets on its own anyway, but it
rejects with `"Incomplete packet"` every time it has to, so framing here just
keeps the client's log clean. `PROXY_FRAMING=raw` forwards chunks untouched
if you ever need to rule the framer out while debugging.

A length prefix that can't be valid (`<= 2`) means the stream is desynced;
the session is dropped with close code `1002` rather than feeding the client
garbage.

## Operational details

- **Handshake order** -- the TCP connection is opened *before* the WebSocket
  upgrade is answered, so an unreachable server shows up as a failed
  handshake (HTTP 502) that `WebSocketAdapter.connect()` rejects on, instead
  of a socket that opens and dies a moment later. This also makes
  `pingGameServer()` report a dead server as unreachable rather than as a
  successful ping.
- **Backpressure** -- both directions pause the reading side when the writing
  side's buffer grows (1 MiB on the WebSocket side), so a slow browser can't
  make the proxy buffer a whole game session in memory.
- **`TCP_NODELAY`** is set on the upstream socket; L2 packets are small and
  latency-sensitive.
- **`GET /health`** on every listener returns `{ status, port, connections, routes }`.
- **`PROXY_ALLOWED_ORIGINS`** gates the upgrade on the browser's `Origin`
  header. WebSocket has no same-origin policy, so with the default `*` any
  page a user visits can reach your L2 server through the proxy. Set it to
  your client's origin for anything public-facing.
- **`SIGINT`/`SIGTERM`** close the listeners and drop live sessions.

## Configuration

Full list with defaults: `.env.example`, or `l2js-proxy --help`. CLI flags
mirror the env vars (`PROXY_DYNAMIC_PORT` → `--dynamic-port`) and win over
them.
