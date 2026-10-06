import { spawn } from "node:child_process";

const port = process.env.FRONTEND_PORT ?? "3000";
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(command, ["exec", "next", "dev", "--port", port], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
