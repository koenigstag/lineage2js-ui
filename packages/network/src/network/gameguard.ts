/**
 * GameGuard challenge -> response, shared by both places this protocol asks
 * the question.
 *
 * The login server asks inside the RSA handshake (the 43-byte "GameGuard
 * special" block of outgoing/login/RequestAuthLogin.ts), and the game server
 * asks again with its own GameGuardQuery packet (incoming/game/
 * GameGuardQuery.ts). Same challenge bytes, same answer -- one table, so the
 * two can't drift apart.
 *
 * The response can't be computed. The reference server's check
 * (lineage2ts's receive/GameGuardReply.ts) accepts a reply only when
 * sha1(reply[0..4) ++ reply[8..12)) equals a hardcoded digest, and sha1
 * doesn't run backwards -- this is the answer a real protected client
 * produces. It's here because it was already in this codebase's login packet,
 * where it turned out to satisfy the game server's digest as well:
 *
 *   sha1(7f97f078 || 710cf689) = 88401ca78342e915dec368f62d23f13fee685bc5
 *
 * which is byte for byte what that handler compares against.
 */

/**
 * The one challenge with a known answer -- and the only one either server has
 * been observed to send. The game server's GameGuardQuery writes it as four
 * int32s (0x27533DD9, 0x2E72A51D, 0x2017038B, -1017438557); little-endian
 * that is exactly these bytes.
 */
const KNOWN_CHALLENGE = "d93d53271da5722e8b031720a31e5bc3";

// prettier-ignore
const KNOWN_RESPONSE = Uint8Array.from([
  0x7f, 0x97, 0xf0, 0x78, 0x04, 0x3c, 0xe6, 0xd6,
  0x71, 0x0c, 0xf6, 0x89, 0xdd, 0x9e, 0x06, 0x70,
]);

/**
 * Sent for any challenge that isn't recognized: the same four values
 * AuthGameGuard already announces as data1..data4 (0x00000123, 0x00004567,
 * 0x000089ab, 0x0000cdef, little-endian), id est "here is what I told you
 * earlier". Not a valid answer to KNOWN_CHALLENGE -- nothing is, except
 * KNOWN_RESPONSE -- but there is nothing better to say to a challenge we
 * can't answer, and a server that enforces GameGuard would reject any
 * guess equally.
 */
// prettier-ignore
const DEFAULT_RESPONSE = Uint8Array.from([
  0x23, 0x01, 0x00, 0x00, 0x67, 0x45, 0x00, 0x00,
  0xab, 0x89, 0x00, 0x00, 0xef, 0xcd, 0x00, 0x00,
]);

/** Lowercase hex of a byte buffer, no separators. */
export function toHexString(buffer: Uint8Array): string {
  return Array.from(buffer, (byte) => ("0" + (byte & 0xff).toString(16)).slice(-2)).join("");
}

/** The 16-byte GameGuard response for a 16-byte challenge. Never throws -- an unknown challenge gets DEFAULT_RESPONSE. */
export function gameGuardResponse(challenge: Uint8Array): Uint8Array {
  return toHexString(challenge) === KNOWN_CHALLENGE ? KNOWN_RESPONSE : DEFAULT_RESPONSE;
}
