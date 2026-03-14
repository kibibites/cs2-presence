import type { Activity } from "discord_rpc";
import { decodeCbor, encodeCbor } from "@std/cbor";
import type { Logger } from "@logtape/logtape";

const Markers = {
  PING: new Uint8Array([0xe2, 0x99, 0xa1]),
  PONG: new Uint8Array([0xe2, 0x99, 0xa5]),
  SYNC: new Uint8Array([0xe2, 0x87, 0x8b]),
  SAVE: new Uint8Array([0xe2, 0x9a, 0x99]),
};

export default class Sockets extends EventTarget {
  #sockets = new Map<WebSocket, number>();
  #interval: number;
  #logger: Logger;

  constructor(logger: Logger) {
    super();

    this.#logger = logger;

    this.#interval = setInterval(() => {
      const now = Date.now();
      for (const [s, p] of this.#sockets.entries()) {
        if (now - p <= 5000) continue;
        s.close();
        this.#sockets.delete(s);
      }
    }, 2000);
  }

  #handleMessage(s: WebSocket, m: MessageEvent<ArrayBuffer>) {
    const data = new Uint8Array(m.data);

    if (data.length < 3) return;

    const marker = data.slice(0, 3);

    const msgType = Object.entries(Markers).find(([_, v]) =>
      marker.every((b, i) => b === v[i])
    );
    if (!msgType) return;

    const msgBody = data.slice(3);

    switch (msgType[0] as keyof typeof Markers) {
      case "PING": {
        this.#sockets.set(s, Date.now());
        s.send(Markers.PONG);
        break;
      }
      case "SAVE": {
        const detail = decodeCbor(msgBody);
        this.dispatchEvent(new CustomEvent("saveConfig", { detail }));
        break;
      }
    }
  }

  add(socket: WebSocket) {
    socket.addEventListener("message", (e) => this.#handleMessage(socket, e));
    socket.addEventListener("close", () => {
      this.#sockets.delete(socket);
      this.#logger.info`client closed. total clients: ${this.#sockets.size}`;
    });

    this.#sockets.set(socket, Date.now());
    this.#logger.info`client added. total clients: ${this.#sockets.size}`;
  }

  update(e: CustomEvent<Activity>) {
    // deno-lint-ignore no-explicit-any
    const data = encodeCbor(e.detail as any);

    const payload = new Uint8Array(3 + data.length);
    payload.set(Markers.SYNC, 0);
    payload.set(data, 3);

    for (const s of this.#sockets.keys()) s.send(payload);
  }

  closeAll() {
    for (const s of this.#sockets.keys()) s.close();
    this.#sockets.clear();
    clearInterval(this.#interval);
    this.#logger.info`closed all connections.`;
  }
}
