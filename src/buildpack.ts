import { _config, _env } from "./utils";
import { posix as path } from "path";
import {
  TwingEnvironment,
  TwingFunction,
  TwingLoaderRelativeFilesystem,
} from "twing";
import * as fs from "fs-extra";

type Options = {
  env: string;
  config: string;
  directory: string;
  output: string;
};

export default async function processBuildpack(options: Options) {
  // template config
  const conf =
    (await _config(path.resolve(options.directory, "config.yml"))) || {};
  // service config
  const service = await _config(path.resolve(options.config));
  // env file config
  const env = await _env(path.resolve(options.env));
  // path
  const dir = {
    template: path.resolve(options.directory),
    project: path.resolve(options.output),
    dockerfile: path.resolve(options.output, "Dockerfile"),
  };
  // context
  const context: Record<string, any> = {
    ...service,
    _env: env,
    __dir: dir,
    __conf: conf,
    __env: process.env,
    __process: process,
  };
  // init template engine
  const loader = new TwingLoaderRelativeFilesystem();
  const twig = new TwingEnvironment(loader, { autoescape: false });
  // process function
  const isTwig = (p: string) => {
    const inp = path.join(dir.template, p);
    return /^.*.twig$/.test(path.basename(inp));
  };
  const copyTwig = async (p: string) => {
    const inp = path.join(dir.template, p);
    // render
    const template = await twig.load(inp);
    const output = await template.render(context);
    // write
    const out = path.join(".buildin", p).replace(".twig", "");
    await fs.outputFile(path.join(dir.project, out), output);
    return out;
  };
  const copyFile = async (p: string) => {
    const inp = path.join(dir.template, p);
    const out = path.join(".buildin", p);
    await fs.copy(inp, path.join(dir.project, out), { overwrite: true });
    return out;
  };
  // twig function
  twig.addFunction(
    new TwingFunction(
      "exists",
      (p: string) => fs.pathExists(path.join(dir.project, p)),
      [{ name: "path" }]
    )
  );
  twig.addFunction(
    new TwingFunction(
      "copy",
      (p: string) => (isTwig(p) ? copyTwig(p) : copyFile(p)),
      [{ name: "path" }]
    )
  );
  // process
  let buildpacks = context.buildpacks;
  if (!buildpacks || buildpacks.length == 0) {
    throw new Error("The buildpacks property must be set.");
  }
  // process buildpack depend
  buildpacks = buildpacks.reduce(
    (all, item) => [...all, ...(conf[item]?.depend || []), item],
    []
  );
  // process buildpack
  let output = "";
  for (let i = 0; i < buildpacks.length; i++) {
    const buildpack = buildpacks[i];
    const inp = path.join(dir.template, buildpack, "Dockerfile.twig");
    // render
    const template = await twig.load(inp);
    output += `\n# ${buildpack} buildpack\n`;
    output += await template.render({
      ...context,
      buildpack: {
        prev: i === 0 ? null : buildpacks[i - 1],
        curr: buildpack,
        next: i === buildpacks.length - 1 ? null : buildpacks[i + 1],
      },
    });
    output += `\n# ${buildpack} buildpack\n`;
  }
  // output to project dir
  await fs.outputFile(dir.dockerfile, output);
}
