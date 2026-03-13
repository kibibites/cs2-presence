import { getLogger } from "@logtape/logtape";
import type { GameState } from "csgo-gsi-types";
import Cs2Rpc from "./cs2rpc.ts";
import { type Activity } from "discord_rpc";
import vdf_config from "../gamestate_integration_cs2presence.cfg" with {
  type: "text",
};
import Clients from "./clients.ts";
import "./logging.ts";

// logging
const log_main = getLogger("cs2-presence");

// controller
const rpc = new Cs2Rpc();
const clients = new Clients(log_main);

// cs2 config
try {
  const vdf = vdf_config.replace("%RANDOM%", crypto.randomUUID()); // not used currently but whatever
  // deno-fmt-ignore
  await Deno.writeTextFile(Deno.build.os === "windows" ? "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg\\gamestate_integration_cs2presence.cfg" : `${Deno.env.get("HOME")}/.local/share/Steam/steamapps/common/Counter-Strike 2/game/csgo/cfg/gamestate_integration_cs2presence.cfg`, vdf);
} catch (e) {
  log_main.warn(`failed to setup config: ${(e as Error).toString()}`);
}

try {
  await rpc.start();
  rpc.addEventListener("updateActivity", (e) => {
    clients.update(e as CustomEvent<Activity>);
  });
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
    await rpc.stop();
    clients.closeAll();
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
    socket.addEventListener("open", () => clients.add(socket));

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
    log_main.debug`${data}`;
    await rpc.handle(data);
  } catch (e) {
    log_main.error`error while handling request: ${(e as Error).toString()}`;
    console.error(e);
  }

  return new Response("ok", { headers: { "content-type": "text/plain" } });
});
