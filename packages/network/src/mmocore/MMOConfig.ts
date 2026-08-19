import IStream from "./IStream";

export default class MMOConfig {
  Username = "";
  Password = "";
  ServerId = 1;
  CharSlotIndex = 0;
  Stream: IStream | string = "auto";
  Ip = "127.0.0.1";
  Port = 2106;
  /** Connect via wss:// instead of ws:// -- required when the page itself is served over https (browsers block a plain ws:// connection from an https origin as mixed content). Carries over to the game-server hop too, see CommandSelectServer's config spread. */
  Secure = false;
  InitialBlowfishKey?: Uint8Array;
}
