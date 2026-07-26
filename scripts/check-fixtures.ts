import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const fixtureRoot = new URL(
  "../packages/extraction/test/fixtures/",
  import.meta.url,
);

const forbidden: Array<[string, RegExp]> = [
  ["cookie", /(?:^|["'\s])(cookie|set-cookie)\s*[:=]/i],
  ["bearer token", /bearer\s+[a-z0-9._~+/-]{8,}/i],
  ["CSRF token", /(?:csrf|csrftoken|x-csrf-token)\s*["':=]+\s*(?!\[REDACTED\])/i],
  ["session ID", /(?:sessionid|session_id)\s*["':=]+\s*(?!\[REDACTED\])/i],
  ["email address", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  [
    "sensitive URL query",
    /[?&](?:token|auth|authorization|csrf|session|cookie|sig|signature|key)=(?!%5BREDACTED%5D|\[REDACTED\])/i,
  ],
];

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = join(path, entry.name);
      return entry.isDirectory() ? filesUnder(target) : [target];
    }),
  );
  return nested.flat();
}

const failures: string[] = [];
for (const file of await filesUnder(fixtureRoot.pathname)) {
  if (![".json", ".jsonl"].includes(extname(file))) continue;
  const contents = await readFile(file, "utf8");
  for (const [name, pattern] of forbidden) {
    if (pattern.test(contents)) failures.push(`${file}: likely ${name}`);
  }
  try {
    const parsed = JSON.parse(contents) as Record<string, unknown>;
    if (!parsed.sourceSchemaDate) {
      failures.push(`${file}: missing sourceSchemaDate`);
    }
  } catch {
    failures.push(`${file}: invalid JSON`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Fixture scan passed.");
}
