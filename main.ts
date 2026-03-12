import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getStreamFileSink } from "@logtape/file";
import type { GameState } from "csgo-gsi-types";
import Cs2Rpc from "./cs2rpc.ts";
import { log } from "node:console";

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
      lowestLevel: "debug",
      sinks: ["console", "file"],
    },
  ],
});

const logger = getLogger("cs2-presence");

// controller
const rpc = new Cs2Rpc();
await rpc.start();

logger.info`log file at: ${log_filename}`;

["SIGINT", "SIGTERM", "SIGBREAK"].forEach((s) => {
  // unsupported signals
  if (Deno.build.os === "windows" && s === "SIGTERM") return;
  if (Deno.build.os === "linux" && s === "SIGBREAK") return;

  Deno.addSignalListener(s as Deno.Signal, async () => {
    await rpc.stop();
    Deno.exit(0);
  });
});

Deno.serve(async (req) => {
  const data = (await req.json()) as GameState;
  logger.debug("received data: {data}", { data });

  await rpc.handle(data);

  return new Response("ok", { headers: { "content-type": "text/plain" } });
});
