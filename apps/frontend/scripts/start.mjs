import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

try {
  process.loadEnvFile(resolve(currentDir, "../../../.env"));
} catch {
  // Root .env is optional; defaults are used when it is absent.
}

const port = process.env.FRONTEND_PORT ?? "3000";
const nextBin = require.resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, "start", "--port", port], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
