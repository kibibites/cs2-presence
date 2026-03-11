import { type Activity, Client } from "discord_rpc";
import type { GameState } from "csgo-gsi-types";

const client = new Client({
  id: "1481083110971019396",
});

const fluffy = false;

const log_filename = await Deno.makeTempFile();
await Deno.writeTextFile(log_filename, "started\n");
console.log("log at: " + log_filename);

let last_updated = Date.now();
setInterval(async () => {
  if (Date.now() - last_updated > 30000) await client.clearActivity();
}, 5000);

await client.connect();

["SIGINT", "SIGTERM", "SIGBREAK"].forEach((s) => {
  if (Deno.build.os === "windows" && s === "SIGTERM") return;
  if (Deno.build.os === "linux" && s === "SIGBREAK") return;
  Deno.addSignalListener(s as Deno.Signal, client.close)
});

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const fmtPlayingState = ({ map, player, round }: GameState) => {
  if (!map || !player) return "Unknown";

  const player_is_t = player.team && player.team.toLowerCase() === "t";
  const t_score = map.team_t.score;
  const ct_score = map.team_ct.score;
  const { kills, assists, deaths } = (player as typeof player & {
    match_stats: { kills: number; assists: number; deaths: number };
  })["match_stats"];

  const phase = (map.phase != "live")
    ? map.phase
    : (round ? (round.bomb ? round.bomb : round.phase) : "unknown");

  return `${capitalize(phase)} | [ ${player_is_t ? t_score : ct_score} : ${
    player_is_t ? ct_score : t_score
  } ] | ${kills}K - ${deaths}D - ${assists}A`;
};

const fmtPlayingDetails = ({ map }: GameState) => {
  if (!map) return "Unknown";

  const mode = {
    "scrimcomp2v2": "wingman",
  }[map.mode] ?? capitalize(map.mode);

  const mapName = {
    "de_ancient_night": "Ancient (Night)",
    "de_dust2": "Dust 2",
    "ar_shoots_night": "Shoots (Night)",
  }[map.name] ?? map.name.split("_").slice(1).map(capitalize).join(" ");

  return `${mode} on ${mapName}`;
};

let time_start: number | undefined;
let old_phase: string | undefined;

const update: Record<string, (data: GameState) => Activity> = {
  "menu": () => ({ details: "In Menu" }),
  "playing": (data) => ({
    details: fmtPlayingDetails(data),
    state: fmtPlayingState(data),
    timestamps: {
      start: time_start,
    },
  }),
};

Deno.serve(async (req) => {
  const data = (await req.json()) as GameState;
  last_updated = Date.now();
  await Deno.writeTextFile(log_filename, JSON.stringify(data) + `\n`, {
    append: true,
  });

  if (data.player?.activity) {
    let upd = update[data.player.activity];
    upd ||= () => ({ details: "Unknown" });

    if (data.round?.phase !== old_phase) {
      time_start = Date.now();
      old_phase = data.round?.phase;
    }

    await client.setActivity({
      ...(upd(data)),
      assets: {
        large_image: Math.random() <= 0.0026 || fluffy ? "fluffy" : "icon",
        large_text: "Counter-Strike 2",
      },
    });
  }

  return new Response("ok", { headers: { "content-type": "text/plain" } });
});
