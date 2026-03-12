import type { GameState } from "csgo-gsi-types";
import Cs2Rpc from "./cs2rpc.ts";

const rpc = new Cs2Rpc();

const log_filename = await Deno.makeTempFile({
  prefix: "cs2-presence-",
  suffix: ".log",
});

console.log("log file at: " + log_filename);

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

  await rpc.handle(data);

  return new Response("ok", { headers: { "content-type": "text/plain" } });
});
