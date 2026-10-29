import { DrizzleQueryError } from "drizzle-orm/errors";

// Drizzle puts the bound parameters (contact name, phone, email, note text)
// into the error message and `params`, so a raw database error must never be
// logged. Only these fields of the underlying error are safe to keep: Postgres
// reports the failing row in `detail`, which is deliberately left out.
const SAFE_CAUSE_FIELDS = [
  "name",
  "message",
  "code",
  "errno",
  "syscall",
  "severity",
  "constraint_name",
  "table_name",
  "column_name",
] as const;

function isQueryError(error: unknown): error is DrizzleQueryError {
  return (
    error instanceof DrizzleQueryError ||
    (error instanceof Error && "query" in error && "params" in error)
  );
}

function pickSafeFields(error: unknown): Record<string, unknown> {
  if (typeof error !== "object" || error === null) {
    return { message: String(error) };
  }
  const source = error as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const field of SAFE_CAUSE_FIELDS) {
    if (source[field] !== undefined) picked[field] = source[field];
  }
  return picked;
}

export function describeDbError(error: unknown): Record<string, unknown> {
  if (isQueryError(error)) {
    // The SQL text only contains column names and $1-style placeholders
    return {
      name: "DrizzleQueryError",
      query: error.query,
      cause: pickSafeFields(error.cause),
    };
  }
  return pickSafeFields(error);
}

export function logDbError(
  message: string,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  console.error(message, { ...context, error: describeDbError(error) });
}
