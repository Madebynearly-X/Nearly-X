import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const forbidden = [
  "OPENAI_API_KEY",
  "ACCESS_AUD",
  "ACCESS_TEAM_DOMAIN",
  "CANVA_CLIENT_SECRET",
  "CANVA_TOKEN_ENCRYPTION_KEY",
  "LINKEDIN_CLIENT_SECRET",
  "LINKEDIN_TOKEN_ENCRYPTION_KEY",
  "TURNSTILE_SECRET_KEY",
  "GOOGLE_SHEETS_WEBHOOK_TOKEN",
];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collect(path) : readFile(path, "utf8").then((content) => ({ path, content }));
  }));
  return files.flat();
}

const files = await collect(fileURLToPath(new URL("../dashboard/", import.meta.url)));
const matches = files.flatMap(({ path, content }) => forbidden
  .filter((name) => content.includes(name))
  .map((name) => `${path}: contains forbidden secret name ${name}`));
if (matches.length) {
  console.error(matches.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Dashboard secret-name check passed across ${files.length} static files.`);
}
