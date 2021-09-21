#!/usr/bin/env node
import { program } from "commander";
import processDockerfile from "./process";

program
  .option("-e --env <path>", "Config env file", ".env")
  .option("-c --config <path>", "Config yml file", ".service.yml")
  .option("-d --directory <path>", "Templates directory", "templates")
  .option("-o --output <path>", "Dockerfile output dir", "dockerfile")
  .action(async (options) => {
    await processDockerfile({
      env: options.env,
      config: options.config,
      directory: options.directory,
      output: options.output,
    });
  })
  .parse(process.argv);
