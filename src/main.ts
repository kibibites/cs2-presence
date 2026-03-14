import { getLogger } from "@logtape/logtape";
import type { GameState } from "csgo-gsi-types";
import Cs2Rpc, { type Options } from "./cs2rpc.ts";
import { type Activity } from "discord_rpc";
import vdf_config from "../gamestate_integration_cs2presence.cfg" with {
  type: "text",
};
import Sockets from "./sockets.ts";
import "./logging.ts";

// logging
const log_main = getLogger("cs2-presence");

// controller
let rpc = new Cs2Rpc();

const startRpc = async (r: Cs2Rpc, s: Sockets) => {
  try {
    await r.start();
    r.addEventListener("updateActivity", (e) => {
      s.update(e as CustomEvent<Activity>);
    });
  } catch (e) {
    log_main.fatal(`failed to connect to discord; ${(e as Error).toString()}`);
    Deno.exit(1);
  }
};

const sockets = new Sockets(log_main);

sockets.addEventListener("saveConfig", async (ev) => {
  log_main.info`restarting rpc with new config...`;
  await rpc.stop();

  rpc = new Cs2Rpc((ev as CustomEvent<Options>).detail);
  await startRpc(rpc, sockets);
});

await startRpc(rpc, sockets);

// make sure requests are good
const secret =
  (new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      crypto.getRandomValues(new Uint8Array(16)),
    ),
  )).toBase64();

// cs2 config
try {
  log_main.info`secret: ${secret}`;
  const vdf = vdf_config.replace("%RANDOM%", secret);
  // deno-fmt-ignore
  await Deno.writeTextFile(Deno.build.os === "windows" ? "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg\\gamestate_integration_cs2presence.cfg" : `${Deno.env.get("HOME")}/.local/share/Steam/steamapps/common/Counter-Strike Global Offensive/game/csgo/cfg/gamestate_integration_cs2presence.cfg`, vdf);
} catch (e) {
  log_main.warn(`failed to setup config: ${(e as Error).toString()}`);
}

["SIGINT", "SIGTERM", "SIGBREAK"].forEach((s) => {
  // unsupported signals
  if (Deno.build.os === "windows" && s === "SIGTERM") return;
  if (Deno.build.os === "linux" && s === "SIGBREAK") return;

  Deno.addSignalListener(s as Deno.Signal, async () => {
    await rpc.stop();
    sockets.closeAll();
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
    socket.addEventListener("open", () => sockets.add(socket));

    return response;
  }

  if (req.method === "GET") {
    return new Response(null, {
      status: 302,
      headers: {
        location: "https://cs2presence.furry.coffee",
      },
    });
  }

  try {
    const data = (await req.json()) as GameState;
    const token = data.auth.token;
    log_main.debug`${data}`;
    if (token !== secret) {
      log_main.warn`token mismatch, ignoring; request: ${token}`;
      return new Response(null, { status: 403 });
    }
    await rpc.handle(data);
  } catch (e) {
    log_main.error`error while handling request: ${(e as Error).toString()}`;
  }

  return new Response("ok", { headers: { "content-type": "text/plain" } });
});
