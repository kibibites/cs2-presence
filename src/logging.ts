import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getStreamFileSink } from "@logtape/file";

const DEV = Deno.env.get("DEV");

const log_filename = DEV ? "./dev.log" : Deno.makeTempFileSync({
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
      category: ["logtape", "meta"],
      sinks: ["console"],
      lowestLevel: "warning",
    },
  ],
});

getLogger("cs2-presence").info`log file at: ${log_filename}`;