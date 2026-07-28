import MMOClient from "../mmocore/MMOClient";
import MMOConfig from "../mmocore/MMOConfig";
import MMOConnection from "../mmocore/MMOConnection";
import LoginCrypt from "./LoginCrypt";
import LoginPacketHandler from "./LoginPacketHandler";
import L2Server from "../entities/L2Server";
import LoginServerPacket from "./outgoing/login/LoginServerPacket";
import IConnection from "../mmocore/IConnection";
import mutators from "./mutators/login/index";
import SocketFactory from "../socket/SocketFactory";

export default class LoginClient extends MMOClient {
  private _loginCrypt: LoginCrypt = new LoginCrypt();
  private _blowfishKey!: Uint8Array;
  Servers: L2Server[] = [];
  ServerId = 1;
  Config!: MMOConfig;

  get BlowfishKey(): Uint8Array {
    return this._blowfishKey;
  }

  set BlowfishKey(blowfishKey: Uint8Array) {
    this._blowfishKey = blowfishKey;
    this._loginCrypt.setKey(blowfishKey);
  }

  constructor() {
    super();
    this.PacketHandler = new LoginPacketHandler();

    mutators.forEach((m) => {
      const mutator = Object.create(m[0], {
        Client: { value: this },
        PacketType: { value: (m[1] as any).name },
      });
      this.registerMutator(mutator);
    });
  }

  init(config: MMOConfig, connection?: IConnection): this {
    this.Connection = connection ?? new MMOConnection(SocketFactory.getSocketAdapter(config), this);

    // Every connection starts its own handshake: the first packet (Init) comes
    // in under the static Blowfish key, and only then does the server hand us
    // the dynamic one. A LoginCrypt that already went through that transition
    // would decrypt the new Init with the *previous* attempt's dynamic key and
    // produce garbage, so a second login on the same Client (e.g. after a wrong
    // password) could never get past Init without a page reload.
    this._loginCrypt = new LoginCrypt();
    this.resetStream();
    this.Servers = [];

    this.Config = config;

    if (config.InitialBlowfishKey != null) {
      this._loginCrypt.setKey(config.InitialBlowfishKey);
    }

    this.Session.username = config.Username;

    if (config.ServerId) {
      this.ServerId = config.ServerId;
    }

    return this;
  }

  pack(lsp: LoginServerPacket): Uint8Array {
    lsp.write();

    if (!lsp.Buffer || lsp.Position === 0) {
      return new Uint8Array();
    }

    const pos = lsp.Position + 4;
    const count = pos + (8 - (pos % 8));

    const data = new Uint8Array(count + 2);
    data.set(lsp.Buffer.slice(0, count), 2);

    this.encrypt(data, 2, count - 2);

    data[0] = (count + 2) & 0xff;
    data[1] = (count + 2) >>> 8;

    return data;
  }

  sendPacket(lsp: LoginServerPacket): Promise<void> {
    let sendable: Uint8Array;
    try {
      // write() validates as it serializes (e.g. RequestAuthLogin rejects an
      // over-long account name). Throwing synchronously out of a method that
      // returns a Promise put the failure somewhere no .catch() could see it:
      // it unwound through fire() into process(), where it was logged as a
      // warning and the awaiting command hung forever.
      sendable = this.pack(lsp);
    } catch (error) {
      return Promise.reject(error);
    }

    this.logger.debug("Sending ", lsp.constructor.name);
    return this.sendRaw(sendable).then(() => {
      this.fire(`PacketSent:${lsp.constructor.name}`, { packet: lsp });
    });
  }

  encrypt(buf: Uint8Array, offset: number, size: number): void {
    this._loginCrypt.encrypt(buf, offset, size);
  }

  decrypt(buf: Uint8Array, offset: number, size: number): void {
    this._loginCrypt.decrypt(buf, offset, size);
  }
}
