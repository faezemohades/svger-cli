#!/usr/bin/env node
import { CLI } from "./utils/native.js";
import { svgService } from "./services/svg-service.js";
import { configService } from "./services/config.js";
import { logger } from "./core/logger.js";

const program = new CLI();

/**
 * svger-cli CLI
 * Custom SVG to React component converter.
 */
program
  .name("svger-cli")
  .description("Custom SVG to React component converter")
  .version("1.0.0");

// -------- Build Command --------
/**
 * Build all SVGs from a source folder to an output folder.
 */
program
  .command("build <src> <out>")
  .description("Build all SVGs from source to output")
  .action(async (args: string[]) => {
    try {
      const [src, out] = args;
      await svgService.buildAll({ src, out });
    } catch (error) {
      logger.error('Build failed:', error);
      process.exit(1);
    }
  });

// -------- Watch Command --------
/**
 * Watch a source folder and rebuild SVGs automatically on changes.
 */
program
  .command("watch <src> <out>")
  .description("Watch source folder and rebuild SVGs automatically")
  .action(async (args: string[]) => {
    try {
      const [src, out] = args;
      await svgService.startWatching({ src, out });
      
      // Keep the process running
      process.on('SIGINT', () => {
        logger.info('Shutting down watch mode...');
        svgService.shutdown();
        process.exit(0);
      });
    } catch (error) {
      logger.error('Watch mode failed:', error);
      process.exit(1);
    }
  });

// -------- Generate Single SVG --------
/**
 * Generate a React component from a single SVG file.
 */
program
  .command("generate <svgFile> <out>")
  .description("Convert a single SVG file into a React component")
  .action(async (args: string[]) => {
    try {
      const [svgFile, out] = args;
      await svgService.generateSingle({ svgFile, outDir: out });
    } catch (error) {
      logger.error('Generation failed:', error);
      process.exit(1);
    }
  });

// -------- Lock / Unlock --------
/**
 * Lock one or more SVG files to prevent accidental overwrites.
 */
program
  .command("lock <files...>")
  .description("Lock one or more SVG files")
  .action((args: string[]) => {
    try {
      svgService.lockService.lockFiles(args);
    } catch (error) {
      logger.error('Lock operation failed:', error);
      process.exit(1);
    }
  });

/**
 * Unlock one or more SVG files to allow modifications.
 */
program
  .command("unlock <files...>")
  .description("Unlock one or more SVG files")
  .action((args: string[]) => {
    try {
      svgService.lockService.unlockFiles(args);
    } catch (error) {
      logger.error('Unlock operation failed:', error);
      process.exit(1);
    }
  });

// -------- Config --------
/**
 * Manage svger-cli configuration.
 */
program
  .command("config")
  .description("Manage svger-cli configuration")
  .option("--init", "Create default .svgconfig.json")
  .option("--set <keyValue>", "Set config key=value")
  .option("--show", "Show current config")
  .action(async (args: string[], opts: Record<string, any>) => {
    try {
      if (opts.init) return await configService.initConfig();
      if (opts.set) {
        const [key, value] = opts.set.split("=");
        if (!key || value === undefined) {
          logger.error("Invalid format. Use key=value");
          process.exit(1);
        }
        const parsedValue = !isNaN(Number(value)) ? Number(value) : value;
        return configService.setConfig(key, parsedValue);
      }
      if (opts.show) return configService.showConfig();
      logger.error("No option provided. Use --init, --set, or --show");
    } catch (error) {
      logger.error('Config operation failed:', error);
      process.exit(1);
    }
  });

// -------- Clean Command --------
/**
 * Remove all generated SVG React components from an output folder.
 */
program
  .command("clean <out>")
  .description("Remove all generated SVG React components from output folder")
  .action(async (args: string[]) => {
    try {
      const [out] = args;
      await svgService.clean(out);
    } catch (error) {
      logger.error('Clean operation failed:', error);
      process.exit(1);
    }
  });

program.parse();
