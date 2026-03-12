import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getStreamFileSink } from "@logtape/file";
import { Eta } from "@bgub/eta";
import ui from "./ui.eta" with { type: "text" };
import type { GameState } from "csgo-gsi-types";
import Cs2Rpc from "./cs2rpc.ts";
import { encodeCbor } from '@std/cbor';
import { type Activity } from "discord_rpc";

// logging
const log_filename = Deno.makeTempFileSync({
  prefix: "cs2-presence-",
  suffix: ".log",
});

await configure({
  sinks: {
    console: getConsoleSink(),
    file: getStreamFileSink(log_filename),
  },
  loggers: [
    {
      category: "cs2-presence",
      sinks: ["console", "file"],
      lowestLevel: "info",
    },
    {
      category: ["cs2-presence", "requests"],
      sinks: ["file"],
      lowestLevel: "debug",
    },
    {
      category: ["logtape", "meta"],
      sinks: ["console"],
      lowestLevel: "warning",
    },
  ],
});

const log_main = getLogger("cs2-presence");
const log_req = log_main.getChild("requests");
log_main.info`log file at: ${log_filename}`;

// templating
const eta = new Eta();

// controller
const rpc = new Cs2Rpc();

// ws connections
const sockets: [WebSocket, number][] = [];

try {
  await rpc.start();
  rpc.addEventListener('updateActivity', (e) => {
    // deno-lint-ignore no-explicit-any
    sockets.forEach(([s]) => s.send(encodeCbor((e as CustomEvent<Activity>).detail as any)));
  })
} catch (e) {
  log_main.fatal(`failed to connect to discord; ${(e as Error).toString()}`);
  Deno.exit(1);
}

log_main.info`connected to discord.`;

["SIGINT", "SIGTERM", "SIGBREAK"].forEach((s) => {
  // unsupported signals
  if (Deno.build.os === "windows" && s === "SIGTERM") return;
  if (Deno.build.os === "linux" && s === "SIGBREAK") return;

  Deno.addSignalListener(s as Deno.Signal, async () => {
    log_main.info`shutting down rpc...`;
    await rpc.stop();
    log_main.info`closing sockets...`;
    sockets.forEach(([s, i]) => {
      s.close();
      clearInterval(i);
    });
    Deno.exit(0);
  });
});

Deno.serve({
  onListen: ({ hostname, port }) => {
    // deno-fmt-ignore
    log_main.info`listening at: ${(new URL(`http://${hostname}:${port}`).toString())}`;
  },
}, async (req) => {
  if ((new URL(req.url)).pathname === "/ws") {
    if (req.headers.get("upgrade") != "websocket") {
      return new Response(null, { status: 426 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.addEventListener("open", () =>
      sockets.push([
        socket,
        setInterval(() => {
          socket.send(new Uint8Array([0xe2, 0x99, 0xa1]));
        }, 3000),
      ]));

    return response;
  }

  if (req.method === "GET") {
    return new Response(
      eta.renderString(ui, {
        options: rpc.options,
      }),
      { headers: { "content-type": "text/html" } },
    );
  }

  try {
    log_req.debug`${req}`;
    const data = (await req.json()) as GameState;
    await rpc.handle(data);
  } catch (e) {
    log_main.error`error while handling request: ${(e as Error).toString()}`;
  }

  return new Response("ok", { headers: { "content-type": "text/plain" } });
});
