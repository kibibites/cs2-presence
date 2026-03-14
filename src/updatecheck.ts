import { greaterThan, parse } from "@std/semver";
import { type Logger } from "@logtape/logtape";

const VERSION = "1.1.7" as const;

const updateCheck = async (log: Logger) => {
  const res = await fetch("https://api.github.com/repos/kibibites/cs2-presence/releases/latest");
  if (res.status !== 200) return log.warn`update check failed, you might not be up to date!`;
  const { html_url, tag_name, published_at } = await res.json();
  if (!greaterThan(parse(tag_name), parse(VERSION))) return log.info`you are up to date!`;
  const binary_url = new URL(`https://github.com/kibibites/cs2-presence/releases/download/${tag_name}/cs2-presence${Deno.build.os === "windows" ? ".exe.xz" : ".xz"}`);
  log.warn`there is an update available! (version: ${tag_name}, published: ${(new Intl.DateTimeFormat(navigator.languages)).format(new Date(published_at))})`;
  log.warn`download url: ${binary_url.toString()}`;
  log.warn`release notes: ${(new URL(html_url)).toString()}`;
}

export {
  updateCheck,
  VERSION
}