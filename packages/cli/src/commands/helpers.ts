import type { Command } from "commander";

export function addOutputOptions<T extends Command>(cmd: T): T {
  return cmd
    .option("--pretty", "Pretty print JSON response")
    .option("--format <type>", "Output format (json, csv, table)")
    .option("--select <fields>", "Comma-separated list of fields to include in output") as T;
}

export function addJsonInputOptions<T extends Command>(cmd: T, bodyDescription = "Request JSON body"): T {
  return cmd
    .option("-d, --data <json>", bodyDescription)
    .option("-f, --data-file <path>", "Request JSON body from file") as T;
}

export function withErrorHandler<TArgs extends unknown[]>(
  handleError: (err: unknown) => void,
  fn: (...args: TArgs) => Promise<void>,
): (...args: TArgs) => Promise<void> {
  return async (...args: TArgs) => {
    try {
      await fn(...args);
    } catch (err) {
      handleError(err);
    }
  };
}
