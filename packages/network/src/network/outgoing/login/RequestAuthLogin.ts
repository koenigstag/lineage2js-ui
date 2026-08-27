import MMOSession from "../../../mmocore/MMOSession";
import LoginServerPacket from "./LoginServerPacket";
import { bigToUint8Array, modPow } from "../../../mmocore/BigintArith";
import { GAMEGUARD_LOGIN_FILLER, gameGuardResponse, toHexString } from "../../gameguard";

export default class RequestAuthLogin extends LoginServerPacket {
  constructor(private username: string, private password: string, private session: MMOSession) {
    super();
  }

  write(): void {
    if (this.username.length > 14) {
      throw Error("Username is too long");
    }

    if (this.password.length > 16) {
      throw Error("Password is too long");
    }

    const loginInfo: Uint8Array = new Uint8Array(128);
    loginInfo[0x5b] = 0x24;
    [...this.username].forEach((k, i) => (loginInfo[0x5e + i] = k.charCodeAt(0)));
    [...this.password].forEach((k, i) => (loginInfo[0x6c + i] = k.charCodeAt(0)));

    const e = BigInt(65537);
    const modulus = BigInt(`0x${toHexString(this.session.publicKey)}`);
    const input = BigInt(`0x${toHexString(loginInfo)}`);
    const encryptedLoginInfo = bigToUint8Array(modPow(input, e, modulus));

    this.writeC(0);
    this.writeB(encryptedLoginInfo);
    this.writeD(this.session.sessionId);

    /**
     * GameGuard special. The next 16 of the remaining 43 bytes answer a
     * GameGuard challenge, the rest is fixed padding. The response table now
     * lives in gameguard.ts, shared with the game server's own GameGuardQuery
     * (which asks the very same challenge -- see that module).
     *
     * The challenge read here is a slice of our own RSA block, so in practice
     * it never matches a known one and the default response goes out; that
     * was already true before, just less visibly -- the old inline lookup
     * compared a lowercase hex string against an uppercase case label, so its
     * one real entry could never be selected either way. Left as-is rather
     * than "fixed" into sending something different: this is what logs in
     * against real servers today.
     */
    const query: Uint8Array = new Uint8Array(16);
    query.set(this._buffer.slice(5, 21), 0);
    this.writeB(gameGuardResponse(query) ?? GAMEGUARD_LOGIN_FILLER);

    this.writeB(Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])); // footer
    this.writeB(Uint8Array.from(Array(16).fill(0)));
  }
}
