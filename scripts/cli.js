#!/usr/bin/env node

const { spawn, execSync, exec } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");

const PORT = process.env.PORT || 18797;
const URL = `http://127.0.0.1:${PORT}`;
const PID_FILE = path.join(os.homedir(), ".weston", "server.pid");

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;

  exec(cmd);
}

function checkIsRunning() {
  if (!fs.existsSync(PID_FILE)) return false;
  
  const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
  if (isNaN(pid)) return false;

  try {
    // Sending signal 0 checks if the process is running without killing it
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // If we reach here, the process is dead but the pid file was left behind
    fs.unlinkSync(PID_FILE);
    return false;
  }
}

async function waitForHealth(url, timeoutMs = 60_000) {
  const start = Date.now();
  console.log(`Waiting for Weston to boot up...`);

  while (Date.now() - start < timeoutMs) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2_000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(t);

      if (res.ok) return;
    } catch {
      // ignore and retry
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`Timed out waiting for Weston to start.`);
}

async function startDetachedNextJs(projectRoot, port) {
  const nextBin = path.join(
    projectRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );

  // We run 'next start' meaning we need a built production app.
  // If the user hasn't built it, this will fail.
  // Assuming the user runs `npm run build` before distributing or we distribute a built version.
  const args = [nextBin, "start", "--port", String(port), "--hostname", "127.0.0.1"];

  const out = fs.openSync(path.join(os.homedir(), ".weston", "out.log"), "a");
  const err = fs.openSync(path.join(os.homedir(), ".weston", "err.log"), "a");

  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    detached: true,    // Run independently of this terminal window
    stdio: ["ignore", out, err], // Pipe output to logs so terminal can close
    env: { ...process.env },
  });

  // Save the PID of the background process
  fs.writeFileSync(PID_FILE, child.pid.toString());
  
  // Unref to allow the current script to exit while the child continues
  child.unref();

  return child;
}

async function handleFlow() {
  console.log(`\nStarting Weston at ${URL}\n`);

  if (checkIsRunning()) {
    console.log("Weston is already running! Opening your browser...");
    openBrowser(URL);
    process.exit(0);
  }

  // Ensure ~/.weston exists for logs and DB
  const westonDir = path.dirname(PID_FILE);
  if (!fs.existsSync(westonDir)) {
    fs.mkdirSync(westonDir, { recursive: true });
  }

  const projectRoot = path.join(__dirname, "..");
  
  // Start the actual Next.js server in the background
  try {
    startDetachedNextJs(projectRoot, PORT);
    
    // Wait until the server throws a 200 OK
    await waitForHealth(`${URL}/api/health`, 30_000);
    
    console.log(`\n✨ Weston ready! Opening browser...\n`);
    openBrowser(URL);
    
    console.log(`You can now safely close this terminal window.`);
    console.log(`To stop Weston later, run: weston stop\n`);
    
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Weston failed to start in the background.");
    console.error(err instanceof Error ? err.message : err);
    
    if (fs.existsSync(PID_FILE)) {
      const p = parseInt(fs.readFileSync(PID_FILE, "utf-8"), 10);
      try { process.kill(p, "SIGKILL"); } catch(e) {}
      fs.unlinkSync(PID_FILE);
    }
    process.exit(1);
  }
}

function handleStop() {
  if (!fs.existsSync(PID_FILE)) {
    console.log("Weston is not currently running (no PID file found).");
    process.exit(0);
  }

  const pidStr = fs.readFileSync(PID_FILE, "utf-8").trim();
  const pid = parseInt(pidStr, 10);
  
  if (isNaN(pid)) {
    console.log("Invalid PID found. Cleaning up lockfile...");
    fs.unlinkSync(PID_FILE);
    process.exit(1);
  }

  try {
    // Attempt to gracefully kill the process
    process.kill(pid, "SIGTERM");
    console.log("🛑 Weston successfully stopped.");
  } catch (e) {
    if (e.code === "ESRCH") {
      console.log("Weston was already stopped.");
    } else {
      console.error("Failed to kill Weston process:", e.message);
    }
  }

  // Always clean up the lockfile
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }
  
  process.exit(0);
}

function handleStatus() {
  if (checkIsRunning()) {
    const pid = fs.readFileSync(PID_FILE, "utf-8").trim();
    console.log(`\n🟢 Weston is running in the background`);
    console.log(`URL: ${URL}`);
    console.log(`PID: ${pid}\n`);
  } else {
    console.log(`\n🔴 Weston is not running.\n`);
  }
}

function handleLogs() {
  const logFile = path.join(os.homedir(), ".weston", "out.log");
  if (!fs.existsSync(logFile)) {
    console.log("No logs found. Weston might not have been started yet.");
    process.exit(0);
  }

  console.log(`\nTailing ${logFile}... (Press Ctrl+C to stop)\n`);
  
  // Use platform-specific tail command to stream logs
  const platform = process.platform;
  try {
    if (platform === "win32") {
      // PowerShell equivalent of tail -f
      spawn("powershell", ["-Command", `Get-Content ${logFile} -Wait -Tail 50`], { stdio: "inherit" });
    } else {
      spawn("tail", ["-f", "-n", "50", logFile], { stdio: "inherit" });
    }
  } catch (e) {
    console.error("Failed to tail logs:", e.message);
  }
}

function handleWipe() {
  const readline = require("node:readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n⚠️  WARNING: This will permanently delete ALL your chats, sources, and memory.");
  console.log("Your API keys will be kept safely in settings.json.\n");

  readline.question("Are you absolutely sure? Type 'YES' to confirm: ", (answer) => {
    if (answer === "YES") {
      const westonDir = path.join(os.homedir(), ".weston");
      const stuffToDelete = [
        path.join(westonDir, "weston.db"),
        path.join(westonDir, "weston.db-shm"),
        path.join(westonDir, "weston.db-wal"),
        path.join(westonDir, "memory"),
        path.join(westonDir, "chats"),
        path.join(westonDir, "identity.md"),
      ];

      console.log("");
      for (const item of stuffToDelete) {
        if (fs.existsSync(item)) {
          try {
            const stat = fs.statSync(item);
            if (stat.isDirectory()) {
              fs.rmSync(item, { recursive: true, force: true });
            } else {
              fs.unlinkSync(item);
            }
            console.log(`✓ Deleted ${path.basename(item)}`);
          } catch (e) {
            console.log(`❌ Failed to delete ${path.basename(item)}: ${e.message}`);
          }
        }
      }
      console.log("\n✨ Wipe complete. Your chat history is gone.");
    } else {
      console.log("\nAborted. Nothing was deleted.");
    }
    readline.close();
  });
}

const command = process.argv[2];

if (command === "flow") {
  handleFlow().catch(console.error);
} else if (command === "stop") {
  handleStop();
} else if (command === "status") {
  handleStatus();
} else if (command === "logs") {
  handleLogs();
} else if (command === "wipe") {
  handleWipe();
} else {
  console.log(`
Usage:
  weston flow    - Starts Weston in the background and opens Chrome
  weston stop    - Kills the background Weston server
  weston status  - Checks if the server is currently running
  weston logs    - Tils the background server logs
  weston wipe    - Deletes all local chat history and sources
  `);
}