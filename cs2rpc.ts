import { GameState } from "csgo-gsi-types";
import { type Activity, Client } from "discord_rpc";

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export interface Options {
  timeout: number;
  fluffy: boolean;
  disableFluffy: boolean;
}

export default class Cs2Rpc extends EventTarget {
  // stateless
  client: Client = new Client({
    id: "1481083110971019396",
  });
  options: Options = {
    timeout: 30000,
    fluffy: false,
    disableFluffy: false,
  };

  // stateful
  #last_updated: number = Date.now();
  #time_start: number | undefined;
  #old_phase: string | undefined;
  #cached_kills = 0;
  #cached_deaths = 0;
  #cached_assists = 0;
  #cached_team = "";
  #interval: number = 0;

  constructor(options?: Partial<Options>) {
    super();

    this.options = {
      ...this.options,
      ...options,
    };
  }

  async #checkTimeout() {
    if ((Date.now() - this.#last_updated) > this.options.timeout) {
      await this.client.clearActivity();
    }
  }

  #fmtPlayingDetails({ map }: GameState) {
    if (!map) return "Unknown";

    // custom mode renames
    const mode = {
      "scrimcomp2v2": "wingman",
    }[map.mode] ?? capitalize(map.mode);

    // custom map renames
    const mapName = {
      "de_ancient_night": "Ancient (Night)",
      "de_dust2": "Dust 2",
      "ar_shoots_night": "Shoots (Night)",
    }[map.name] ?? map.name.split("_").slice(1).map(capitalize).join(" ");

    return `${mode} on ${mapName}`;
  }

  async start() {
    this.#interval = setInterval(() => this.#checkTimeout(), 5000);
    this.client = await this.client.connect();
  }

  async stop() {
    clearInterval(this.#interval);
    await this.client.clearActivity();
    this.client.close();
  }

  #fmtPlayingState({ map, player, round, provider }: GameState) {
    if (!map || !provider) return "Unknown";

    // update cached stats
    if (player && player.steamid === provider.steamid) {
      if (player.team) this.#cached_team = player.team.toLowerCase();
      const stats = (player as (typeof player & {
        match_stats?: { kills: number; assists: number; deaths: number };
      })).match_stats;

      if (stats) {
        this.#cached_kills = stats.kills;
        this.#cached_deaths = stats.deaths;
        this.#cached_assists = stats.assists;
      }
    }

    const player_is_t = this.#cached_team === "t";

    // deno-fmt-ignore
    const phase = map.phase != "live" ? map.phase : (round ? (round.bomb ? round.bomb : round.phase) : "unknown");
    // deno-fmt-ignore
    const scores = `[ ${player_is_t ? `${map.team_t.score} : ${map.team_ct.score}` : `${map.team_ct.score} : ${map.team_t.score}`} ]`;
    // deno-fmt-ignore
    const kda = `${this.#cached_kills}K - ${this.#cached_deaths}D - ${this.#cached_assists}A`;

    return `${capitalize(phase)} | ${scores} | ${kda}`;
  }

  async #update(state: GameState) {
    // deno-fmt-ignore
    const isFluffy = !this.options.disableFluffy && (Math.random() <= 0.0026 || this.options.fluffy);

    const activity: Activity = {
      ...({
        "menu": { details: "In Menu" },
        "playing": {
          details: this.#fmtPlayingDetails(state),
          state: this.#fmtPlayingState(state),
          timestamps: {
            start: this.#time_start,
          },
        },
        "free": { details: "Free" },
        "textinput": { details: "Textinput" },
        "unknown": { details: "Unknown" },
      }[state.player?.activity || "unknown"]),
      assets: {
        large_image: isFluffy ? "fluffy" : "icon",
        large_text: "Counter-Strike 2",
      },
    };

    await this.client.setActivity(activity);
    this.dispatchEvent(new CustomEvent('updateActivity', { detail: activity }));
  }

  async handle(state: GameState) {
    this.#last_updated = Date.now();

    if (state.round?.phase !== this.#old_phase) {
      this.#time_start = Date.now();
      this.#old_phase = state.round?.phase;
    }

    await this.#update(state);
  }
}
