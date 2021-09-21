import * as path from "path";
import { _config, _env, walk } from "./utils";
import * as fs from "fs-extra";
import {
  TwingEnvironment,
  TwingFilter,
  TwingLoaderRelativeFilesystem,
} from "twing";

type Options = {
  env: string;
  config: string;
  directory: string;
  output: string;
};

export default async function processDockerfile(options: Options) {
  // template config
  const conf =
    (await _config(path.resolve(options.directory, "config.yml"))) || {};
  // service config
  const service = await _config(path.resolve(options.config));
  // env file config
  const env = await _env(path.resolve(options.env));
  // context
  const context: Record<string, any> = {
    ...service,
    _env: env,
    __conf: conf,
    __env: process.env,
    __process: process,
  };
  const dir = {
    template: path.resolve(options.directory),
    project: path.resolve(options.output),
    type: path.resolve(options.directory, context.type),
    buildin: path.resolve(options.output, ".buildin"),
  };
  // init template engine
  const loader = new TwingLoaderRelativeFilesystem();
  const twig = new TwingEnvironment(loader, { autoescape: false });
  twig.addFilter(
    new TwingFilter("exists", (p) => fs.pathExists(path.join(dir.project, p)), [
      { name: "path" },
    ])
  );
  // process function
  const isTwig = (p: string) => /^.*.twig$/.test(path.basename(p));
  const processTwig = async (p: string, relative: string) => {
    if (path.basename(p).startsWith("_")) {
      return;
    }
    // render
    const template = await twig.load(p);
    const output = await template.render(context);
    // write
    const outputPath = path.join(dir.buildin, relative).replace(".twig", "");
    await fs.outputFile(outputPath, output);
  };
  const copyFile = async (p: string, relative: string) => {
    await fs.copy(p, path.join(dir.buildin, relative), { overwrite: true });
  };
  // processor
  const defaultTypeProcessor = async () => {
    // walk all file
    // templates-dir/type -> output-dir/.buildin
    for await (const p of walk(dir.type)) {
      const relative = path.relative(dir.type, p);
      if (isTwig(p)) {
        await processTwig(p, relative);
      } else {
        await copyFile(p, relative);
      }
    }
    // copy config define files
    if (conf[context.type]?.copy) {
      for (const item of conf[context.type]?.copy) {
        const [type, relative] = item.split(":");
        const p = path.join(dir.template, type, relative);
        if (isTwig(p)) {
          await processTwig(p, relative);
        } else {
          await copyFile(p, relative);
        }
      }
    }
    // move dockerfile
    // output-dir/.buildin/Dockerfile -> output-dir/Dockerfile
    await fs.move(
      path.join(dir.buildin, "Dockerfile"),
      path.join(dir.project, "Dockerfile"),
      { overwrite: true }
    );
    // move env file
    if (service.env_file) {
      await fs.copy(
        path.resolve(options.env),
        path.join(dir.project, service.env_file)
      );
    }
  };
  const dockerfileTypeProcessor = async () => {
    await processTwig(
      path.join(dir.project, "Dockerfile.twig"),
      "../Dockerfile"
    );
  };
  if (context.type === "docker") {
    await dockerfileTypeProcessor();
  } else {
    await defaultTypeProcessor();
  }
}
