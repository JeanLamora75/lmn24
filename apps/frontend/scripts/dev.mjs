import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(resolve(currentDir, "../../../.env"));
} catch {
  // Root .env is optional; Next.js defaults are used when it is absent.
}

const port = process.env.FRONTEND_PORT ?? "3000";
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(command, ["exec", "next", "dev", "--port", port], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
