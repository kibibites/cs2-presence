import { greaterThan, parse } from "@std/semver";
import { type Logger } from "@logtape/logtape";

const VERSION = "1.1.4" as const;

const updateCheck = async (log: Logger) => {
  const res = await fetch("https://api.github.com/repos/kibibites/cs2-presence/releases/latest");
  if (res.status !== 200) return log.warn`update check failed, you might not be up to date!`;
  const { html_url, tag_name, published_at } = await res.json();
  if (!greaterThan(parse(tag_name), parse(VERSION))) return log.info`you are up to date!`;
  const fmt = new Intl.RelativeTimeFormat("en");
  const relative = Date.now() - (new Date(published_at)).getTime();
  const binary_url = new URL(`https://github.com/kibibites/cs2-presence/releases/download/${tag_name}/cs2-presence${Deno.build.os === "windows" ? ".exe.xz" : ".xz"}`);
  log.info`there is an update from ${fmt.format(relative, Math.abs(relative) > 8.64e+7 ? "days" : "hours")} available!`;
  log.info`download url: ${binary_url.toString()}`;
  log.info`release notes: ${(new URL(html_url)).toString()}`;
}

export {
  updateCheck,
  VERSION
}