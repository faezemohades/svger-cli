import type { Command } from '../application/command.js';
import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';
import {
  runMigration,
  type MigrationOptions,
  type MigrationReport,
} from '../migration/migration-toolkit.js';

const TARGETS = new Set(['config', 'imports', 'plugins']);

export class MigrateCommand
  implements Command<MigrationOptions, MigrationReport>
{
  public validate(options: MigrationOptions): void {
    if (!TARGETS.has(options.target)) {
      throw new DiagnosticError(
        'E_MIGRATION_TARGET',
        `Unknown migration target: ${options.target}`,
        { exitCode: ExitCode.UsageError }
      );
    }
    if (!options.inputPath) {
      throw new DiagnosticError(
        'E_MIGRATION_PATH',
        'Migration input path is required.',
        { exitCode: ExitCode.UsageError }
      );
    }
  }

  public execute(options: MigrationOptions): Promise<MigrationReport> {
    return runMigration(options);
  }
}
