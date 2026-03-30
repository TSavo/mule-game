/**
 * Global setup/teardown for E2E tests.
 * Starts the game server ONCE before all tests, stops it after.
 * Runs in vitest's main process (not a worker), avoiding channel issues.
 */
import { spawn, ChildProcess } from "child_process";
import path from "path";

let serverProcess: ChildProcess | null = null;

export async function setup() {
  const serverDir = path.resolve(__dirname, "../../server");

  // Kill any stale server on the port
  try {
    const { execSync } = await import("child_process");
    execSync("lsof -ti:2567 | xargs kill -9 2>/dev/null", { stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 1000));
  } catch {}

  serverProcess = spawn(
    "npx",
    ["tsx", "--import", "./polyfill.mjs", "src/index.ts"],
    {
      cwd: serverDir,
      stdio: "pipe",
      env: { ...process.env, PORT: "2567" },
      detached: true,
    },
  );

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server start timeout")), 15_000);

    serverProcess!.stdout?.on("data", (data: Buffer) => {
      if (data.toString().includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess!.stderr?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.error("[server]", text);
    });

    serverProcess!.on("error", (err) => { clearTimeout(timeout); reject(err); });
    serverProcess!.on("exit", (code) => { clearTimeout(timeout); reject(new Error(`Server exited with ${code}`)); });
  });

  console.log("[global-setup] Server started on port 2567");
}

export async function teardown() {
  if (serverProcess?.pid) {
    // Kill entire process group (npx -> tsx -> node)
    try { process.kill(-serverProcess.pid, "SIGKILL"); } catch {}
    try { serverProcess.kill("SIGKILL"); } catch {}
  }
  // Fallback: kill by port
  try {
    const { execSync } = await import("child_process");
    execSync("lsof -ti:2567 | xargs -r kill -9", { stdio: "ignore" });
  } catch {}
  console.log("[global-setup] Server stopped");
}
