const { spawn, exec } = require("child_process");
const path = require("path");
const os = require("os");
const net = require("net");

// Configuration
const PORT = 3000; // Expected port for the server
const CHECK_INTERVAL = 500; // Check every 500ms
const URL = `http://localhost:${PORT}`;

console.log("🚀 Starting Bot X to Discord Launcher...");

// Determine the command to run yarn
const isWin = os.platform() === "win32";
const yarnCmd = isWin ? "yarn.cmd" : "yarn";

// Spawn the 'yarn dev' process
console.log("Running 'yarn dev'...");
const serverProcess = spawn(yarnCmd, ["dev"], {
  cwd: __dirname,
  stdio: "inherit", // Pipe output to this process's stdout/stderr
  shell: true,
});

serverProcess.on("error", (err) => {
  console.error(`❌ Failed to start server: ${err.message}`);
});

// Function to check if the port is in use (server is ready)
const checkServerReady = () => {
  const socket = new net.Socket();
  socket.setTimeout(1000);

  socket.on("connect", () => {
    socket.destroy();
    console.log(`✅ Server is ready at ${URL}`);
    openBrowser();
  });

  socket.on("timeout", () => {
    socket.destroy();
    setTimeout(checkServerReady, CHECK_INTERVAL);
  });

  socket.on("error", (err) => {
    socket.destroy();
    setTimeout(checkServerReady, CHECK_INTERVAL);
  });

  socket.connect(PORT, "localhost");
};

// Function to open the browser in app mode
const openBrowser = () => {
  console.log("🌐 Opening browser in App Mode...");

  let command;
  if (isWin) {
    // Try Chrome first, then Edge
    // We use 'start' to detach the browser process so closing it doesn't kill the server immediately if we don't want it to
    // But for a launcher, usually closing the launcher closes the app.
    // Here we just fire and forget the browser, the launcher process stays alive because of the serverProcess.

    // Command to try opening Chrome in app mode
    const chromeCommand = `start chrome --app=${URL}`;
    const edgeCommand = `start msedge --app=${URL}`;

    // We'll just try Chrome, if it fails (not easily detectable with 'start'), user might need to ensure chrome is installed.
    // Actually 'start' will usually work if the alias is registered.

    exec(chromeCommand, (err) => {
      if (err) {
        console.log("⚠️ Chrome not found or failed to open, trying Edge...");
        exec(edgeCommand, (err2) => {
          if (err2) {
            console.error("❌ Failed to open browser automatically.");
            console.log(`Please open ${URL} manually.`);
          }
        });
      }
    });
  } else {
    // Fallback for other OS (standard open)
    const start =
      process.platform == "darwin"
        ? "open"
        : process.platform == "linux"
          ? "xdg-open"
          : "";
    if (start) {
      exec(`${start} ${URL}`);
    } else {
      console.log(`Please open ${URL} manually.`);
    }
  }
};

// Start checking for server readiness
checkServerReady();

// Handle exit
process.on("SIGINT", () => {
  console.log("\nStopping server...");
  serverProcess.kill();
  process.exit();
});
