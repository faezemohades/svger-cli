/** A command validates its input before performing any operation. */
export interface Command<TOptions, TResult> {
  validate(options: TOptions): void | Promise<void>;
  execute(options: TOptions): Promise<TResult>;
}

export async function executeCommand<TOptions, TResult>(
  command: Command<TOptions, TResult>,
  options: TOptions
): Promise<TResult> {
  await command.validate(options);
  return command.execute(options);
}
