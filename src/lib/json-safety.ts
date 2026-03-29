/**
 * Safely parse a JSON string that should be a string array (for message options).
 * Returns null if parsing fails or result isn't a string array.
 */
export function safeParseOptions(json: string | null): string[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
    ) {
      return parsed as string[];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely stringify options for DB storage.
 * Returns null if input is not a valid string array.
 */
export function safeStringifyOptions(options: unknown): string | null {
  if (!options) return null;
  if (
    !Array.isArray(options) ||
    !options.every((item) => typeof item === 'string')
  ) {
    return null;
  }
  try {
    return JSON.stringify(options);
  } catch {
    return null;
  }
}
