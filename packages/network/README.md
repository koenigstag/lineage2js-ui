# @lineage2js/network

Lineage 2 (High Five, protocols 268/271/273) login/game network protocol
layer -- packets, encryption, sockets. Vendored from
[l2js-client](https://github.com/npetrovski/l2js-client) (`websocket-client`
branch), browser-only (WebSocket transport, no raw TCP).

## Protocol references

The vendored packet parsers/writers aren't always accurate (e.g. fields that
are read but never exposed, or misaligned reads for less-common packets).
When fixing or extending a packet, these two server-side implementations are
useful ground truth for the actual wire format:

- [lineage2ts](https://gitlab.com/MrTREX/lineage2ts/-/tree/master/game-server/source/gameService/packets?ref_type=heads) --
  TypeScript game server, packet read/write code under `game-server/source/gameService/packets`.
- [L2J_Mobius](https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/tree/master/L2J_Mobius_CT_2.6_HighFive/java/org/l2jmobius/gameserver/network?ref_type=heads) --
  Java game server, High Five chronicle, under `L2J_Mobius_CT_2.6_HighFive/java/org/l2jmobius/gameserver/network`.
