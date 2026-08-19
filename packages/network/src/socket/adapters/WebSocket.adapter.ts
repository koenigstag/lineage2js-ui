import IStream from "../../mmocore/IStream";

export default class WebSocketAdapter implements IStream {
  private ws!: WebSocket;
  private queue: Uint8Array[] = [];
  private waitingResolve: ((value: Uint8Array) => void) | null = null;
  private waitingReject: ((reason: Error) => void) | null = null;
  private timeout = 5000;

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ws.close();
        reject(new Error("WebSocket timeout"));
      }, this.timeout);

      this.ws = new WebSocket(this.url);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };

      this.ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("WebSocket error"));
        this.rejectPending(new Error("WebSocket error"));
      };

      // Also handles disconnects *after* a successful connect (server-side
      // close, network drop) -- without this, a recv() awaiting the next
      // message would hang forever instead of surfacing the disconnect.
      this.ws.onclose = () => {
        clearTimeout(timer);
        reject(new Error("WebSocket closed before connecting"));
        this.rejectPending(new Error("Connection is closed"));
      };

      this.ws.onmessage = (event) => {
        const data = new Uint8Array(event.data as ArrayBuffer);
        if (this.waitingResolve) {
          this.waitingResolve(data);
          this.waitingResolve = null;
          this.waitingReject = null;
        } else {
          this.queue.push(data);
        }
      };
    });
  }

  private rejectPending(err: Error): void {
    if (this.waitingReject) {
      const reject = this.waitingReject;
      this.waitingResolve = null;
      this.waitingReject = null;
      reject(err);
    }
  }

  recv(): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("Connection is closed"));
      }
      if (this.queue.length > 0) {
        resolve(this.queue.shift()!);
      } else {
        this.waitingResolve = resolve;
        this.waitingReject = reject;
      }
    });
  }

  send(bytes: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(bytes);
        resolve();
      } else {
        reject(new Error("Connection is closed"));
      }
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws) {
        return resolve();
      }
      this.ws.onclose = () => {
        this.rejectPending(new Error("Connection is closed"));
        resolve();
      };
      this.ws.close();
    });
  }

  toString(): string {
    return this.url;
  }
}
