import IStream from "../mmocore/IStream";
import MMOConfig from "../mmocore/MMOConfig";
import WebSocketAdapter from "./adapters/WebSocket.adapter";

export default class SocketFactory {
  static getSocketAdapter(config: MMOConfig): IStream {
    const stream: IStream | string = config.Stream;
    if (typeof stream === "object" && "connect" in (stream as any)) {
      return stream as IStream;
    }

    switch (stream) {
      case "auto":
      case "websocket":
        return new WebSocketAdapter(`ws://${config.Ip}:${config.Port}`);
    }

    throw new Error("Cannot find appropriate socket adapter");
  }
}
