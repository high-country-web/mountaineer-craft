import { exec } from "child_process";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

/*
  -------------------------------------------------
  Discord Bot Watcher
  -------------------------------------------------
  - Pulls updates from git
  - Restarts bot when backend changes
  - Reinstalls dependencies if needed
  - Restarts container if watcher changes
  -------------------------------------------------
*/

const __filename = fileURLToPath(import.meta.url);
const WATCHER_FILE = path.basename(__filename);

const REPO_DIR = process.cwd();
const BOT_DIR = path.join(REPO_DIR, "bot");

let botProcess = null;
let checking = false;
let intentionalStop = false;

/**
 * Run a shell command and return stdout
 */
function run(cmd, cwd = REPO_DIR) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[watcher] command failed: ${cmd}`);
        console.error(stderr || err.message);
        return reject(err);
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Stop Discord bot
 */
function stopBot() {
  return new Promise((resolve) => {
    if (!botProcess) return resolve();

    console.log("[watcher] Stopping Discord bot...");
    intentionalStop = true;

    botProcess.once("exit", () => {
      console.log("[watcher] Discord bot stopped.");
      botProcess = null;
      resolve();
    });

    botProcess.kill("SIGTERM");
  });
}

/**
 * Start Discord bot
 */
async function startBot() {
  if (botProcess) {
    console.log("[watcher] Bot already running.");
    return;
  }

  console.log("[watcher] Starting Discord bot...");
  intentionalStop = false;

  botProcess = spawn("npm", ["run", "dev"], {
    cwd: BOT_DIR,
    stdio: "inherit",
  });

  botProcess.on("exit", (code) => {
    console.log(`[watcher] Bot exited with code ${code}`);
    botProcess = null;

    if (!intentionalStop && code !== 0) {
      console.log("[watcher] Restarting bot after crash...");
      setTimeout(startBot, 5000);
    }
  });
}

/**
 * Restart bot cleanly
 */
async function restartBot() {
  console.log("[watcher] Restarting Discord bot...");
  await stopBot();
  await startBot();
}

/**
 * Check for git updates
 */
async function checkForUpdates() {
  if (checking) return;
  checking = true;

  try {
    const oldCommit = await run("git rev-parse HEAD");

    await run("git pull origin main");

    const newCommit = await run("git rev-parse HEAD");

    if (oldCommit === newCommit) {
      checking = false;
      return;
    }

    console.log(`[watcher] New commit detected: ${newCommit}`);

    const diff = await run(`git diff --name-only ${oldCommit} ${newCommit}`);
    const files = diff.split("\n").filter(Boolean);

    const watcherChanged = files.some((file) => path.basename(file) === WATCHER_FILE);

    const botChanged = files.some((file) => file.startsWith("bot/"));

    const packageChanged = files.includes("bot/package.json");

    if (watcherChanged) {
      console.log("[watcher] Watcher updated. Restarting container...");
      process.exit(0); // Pterodactyl/Docker will restart container
    }

    if (botChanged) {
      console.log("[watcher] Bot changes detected.");

      if (packageChanged) {
        console.log("[watcher] Installing new dependencies...");
        await run("npm install", BOT_DIR);
      }

      await restartBot();
    } else {
      console.log("[watcher] Non-bot changes detected.");
    }
  } catch (err) {
    console.error("[watcher] Update check failed:", err.message);
  }

  checking = false;
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log("[watcher] Shutting down...");
  await stopBot();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

/**
 * Initial startup
 */
(async () => {
  console.log("[watcher] Starting watcher...");
  console.log(`[watcher] Repository directory: ${REPO_DIR}`);

  await run("git pull origin main");

  await run("npm install", BOT_DIR);

  await startBot();

  console.log("[watcher] Watching for updates every 60 seconds.");

  setInterval(checkForUpdates, 60 * 1000);
})();
