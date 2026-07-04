import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pythonCommand = "py";
const requirementsFile = path.join(rootDir, "scripts", "requirements.txt");
const extractScript = path.join(rootDir, "scripts", "extract_pdf.py");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(pythonCommand, [
  "-3",
  "-m",
  "pip",
  "install",
  "--disable-pip-version-check",
  "-r",
  requirementsFile,
]);

run(pythonCommand, ["-3", extractScript, ...process.argv.slice(2)]);
