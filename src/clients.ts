import type { Activity } from "discord_rpc";
import { encodeCbor } from "@std/cbor";
import type { Logger } from "@logtape/logtape";

export default class Clients {
  #sockets = new Map<WebSocket, number>();
  #interval: number;
  #logger: Logger;

  constructor(logger: Logger) {
    this.#logger = logger;

    // check ws timeouts
    this.#interval = setInterval(() => {
      const now = Date.now();
      this.#sockets.entries().forEach(([s, p]) => {
        if (now - p > 5000) s.close();
      });
    }, 2000);
  }

  #handleMessage(s: WebSocket, m: MessageEvent<ArrayBuffer>) {
    const data = new Uint8Array(m.data);

    // heartbeat
    const ping = new Uint8Array([0xe2, 0x99, 0xa1]);
    if (data.length !== 3 || !data.every((v, i) => v === ping[i])) return;
    this.#sockets.set(s, Date.now());
    s.send(new Uint8Array([0xe2, 0x99, 0xa5]));
  }

  add(socket: WebSocket) {
    // handle state changes
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
    this.#sockets.keys().forEach((s) => s.send(data));
  }

  closeAll() {
    this.#sockets.keys().forEach((s) => s.close());
    this.#sockets.clear();
    clearInterval(this.#interval);
    this.#logger.info`closed all connections.`;
  }
}
