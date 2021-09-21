import fs from "fs-extra";
import yaml from "yaml";
import path from "path";
import { parse } from "dotenv";

export async function _config(filename: string): Promise<Record<string, any>> {
  if (await fs.pathExists(filename)) {
    return yaml.parse((await fs.promises.readFile(filename)).toString()) || {};
  }
  return {};
}

export async function _env(filename: string): Promise<Record<string, any>> {
  if (await fs.pathExists(filename)) {
    return parse((await fs.promises.readFile(filename)).toString()) || {};
  }
  return {};
}

export async function* walk(dir) {
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* await walk(entry);
    else if (d.isFile()) yield entry;
  }
}
