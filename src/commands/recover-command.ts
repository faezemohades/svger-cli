import path from 'path';
import type { Command } from '../application/command.js';
import {
  recoverOutputTransactions,
  type RecoveryReport,
} from '../application/output-transaction.js';
import { DiagnosticError, ExitCode } from '../contracts/diagnostics.js';

export interface RecoverCommandOptions {
  directory: string;
}

export class RecoverCommand
  implements Command<RecoverCommandOptions, RecoveryReport>
{
  public validate(options: RecoverCommandOptions): void {
    if (!options.directory) {
      throw new DiagnosticError(
        'E_USAGE_RECOVER_DIRECTORY',
        'A transaction journal directory is required.',
        { exitCode: ExitCode.UsageError }
      );
    }
  }

  public execute(options: RecoverCommandOptions): Promise<RecoveryReport> {
    return recoverOutputTransactions(path.resolve(options.directory));
  }
}
