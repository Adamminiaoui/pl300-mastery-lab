import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validateScript = path.join(rootDir, "scripts", "validate_questions.py");

const result = spawnSync("py", ["-3", validateScript, ...process.argv.slice(2)], {
  cwd: rootDir,
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
