import { randomBytes } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";

const target = new URL("../.env", import.meta.url);
const example = new URL("../.env.example", import.meta.url);

try {
  await access(target);
  console.log(".env already exists; leaving it unchanged.");
} catch {
  const template = await readFile(example, "utf8");
  const pepper = randomBytes(32).toString("base64url");
  const contents = template.replace(
    "replace-with-a-long-random-secret",
    pepper,
  );
  await writeFile(target, contents, { encoding: "utf8", mode: 0o600 });
  console.log("Created .env with a random local token pepper.");
}
