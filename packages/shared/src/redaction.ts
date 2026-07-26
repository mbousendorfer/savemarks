const SECRET_KEY =
  /(authorization|cookie|set-cookie|x-csrf-token|csrf|session|token|password)/i;
const SECRET_VALUE =
  /(bearer\s+[a-z0-9._~+/-]+=*|(?:auth_token|sessionid|csrftoken)=[^;\s]+)/gi;

export function redactString(value: string): string {
  return value.replace(SECRET_VALUE, "[REDACTED]");
}

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        SECRET_KEY.test(key) ? "[REDACTED]" : redactSecrets(child),
      ]),
    );
  }
  return value;
}
