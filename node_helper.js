const NodeHelper = require("node_helper");
const Log = require("logger");
const net = require("net");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { PythonShell } = require("python-shell");

// sqlite3 ships a native binding that npm has to build on install. Require it
// defensively: a missing or broken binding must not take down this node_helper
// (or the rest of MagicMirror) with an opaque "Could not locate the bindings
// file" crash. We log an actionable fix instead and keep everything else alive.
let sqlite3 = null;
try {
  sqlite3 = require("sqlite3");
} catch (err) {
  Log.error(
    `[MMM-FastNotes] Could not load the sqlite3 dependency: ${err.message}\n` +
    `[MMM-FastNotes] Fix: run "npm install" inside modules/MMM-FastNotes - this ` +
    `builds the native sqlite3 binding (npm >= 11 gates install scripts; this ` +
    `module's package.json already declares allowScripts for sqlite3).\n` +
    `[MMM-FastNotes] Note display is disabled until then; the rest of MagicMirror keeps running.`
  );
}

// Restart policy for the Flask web UI. Fast backoff for the first attempts,
// then one quiet retry every few minutes so a real misconfiguration does not
// flood the log but the UI still comes back once it is fixed.
const MAX_FAST_RESTARTS = 5;
const FAST_RESTART_DELAY = 3000;      // x2 per attempt
const QUIET_RESTART_DELAY = 5 * 60 * 1000;
const ALIVE_AFTER = 60 * 1000;        // a run this long resets the counter
const OCCUPIED_RECHECK_DELAY = 60 * 1000;

module.exports = NodeHelper.create({

  start: function () {
    this.pyProcess = null;
    this.dbTimer = null;
    this.serverTimer = null;
    this.restartAttempts = 0;
    this.startedAt = 0;
    this.stopping = false;
    this.occupiedLogged = false;
    Log.log(`Starting node_helper for: ${this.name}`);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "START_FAST_NOTES") {
      this.config = payload;
      this.stopping = false;
      this.occupiedLogged = false;
      this.ensureServer();

      // Tell the frontend which URL the QR code should point to. We encode the
      // plain LAN IPv4, not <hostname>.local: mDNS resolution is unreliable
      // across client OSes (and was the reason the QR feature exists).
      if (this.config.QRCode) {
        const ip = this.lanIPv4();
        if (ip) {
          const port = Number(this.config.port) || 5000;
          this.sendSocketNotification("FAST_NOTES_URL", `http://${ip}:${port}`);
        } else {
          Log.warn("[MMM-FastNotes] QRCode is enabled but no LAN IPv4 address was found - skipping QR code.");
        }
      }

      // only ever keep one poll interval alive
      if (this.dbTimer) {
        clearInterval(this.dbTimer);
      }
      this.dbTimer = setInterval(() => {
        this.readDb();
      }, this.config.updateInterval);
    }
  },

  /*
   * Called by MagicMirror on shutdown (SIGINT / before-quit).
   * Ends the DB polling and takes the Flask process down with us so it
   * cannot outlive MagicMirror and block port 5000 on the next start.
   */
  stop: function () {
    this.stopping = true;
    if (this.dbTimer) {
      clearInterval(this.dbTimer);
      this.dbTimer = null;
    }
    if (this.serverTimer) {
      clearTimeout(this.serverTimer);
      this.serverTimer = null;
    }
    if (this.pyProcess && this.pyProcess.childProcess && !this.pyProcess.terminated) {
      Log.log(`[MMM-FastNotes] Stopping web UI process (pid ${this.pyProcess.childProcess.pid})`);
      this.pyProcess.kill("SIGTERM");
    }
    this.pyProcess = null;
  },

  /*
   * First non-internal IPv4 address of this machine, i.e. the address other
   * LAN devices use to reach us. Returns null when there is none.
   */
  lanIPv4: function () {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const addr of interfaces[name] || []) {
        if ((addr.family === "IPv4" || addr.family === 4) && !addr.internal) {
          return addr.address;
        }
      }
    }
    return null;
  },

  /*
   * Maps the configured host to the address we actually bind to.
   *
   * "0.0.0.0" (the default, "reachable from the LAN") becomes "::" when the
   * system supports IPv6: a dual-stack socket then answers on IPv4 AND IPv6.
   * That matters because mDNS resolves <hostname>.local to either address
   * family depending on the client, and an IPv4-only bind makes the web UI
   * unreachable for every client that happens to get the AAAA record.
   * Falls back to plain "0.0.0.0" on hosts without IPv6.
   */
  resolveBindHost: function (host) {
    if (host !== "0.0.0.0") {
      return Promise.resolve(host);
    }
    return new Promise((resolve) => {
      const probe = net.createServer()
        .once("error", () => resolve("0.0.0.0"))
        .once("listening", () => probe.close(() => resolve("::")))
        .listen(0, "::");
    });
  },

  /*
   * Resolves to true when something is already listening on host:port.
   * Keeps us from fighting over the port with another instance of the
   * web UI (e.g. one started outside of MagicMirror).
   */
  portInUse: function (port, host) {
    return new Promise((resolve) => {
      const probe = net.createServer()
        .once("error", (err) => resolve(err && err.code === "EADDRINUSE"))
        .once("listening", () => probe.close(() => resolve(false)))
        .listen(port, host);
    });
  },

  scheduleCheck: function (delay) {
    if (this.stopping || this.serverTimer) {
      return;
    }
    this.serverTimer = setTimeout(() => {
      this.serverTimer = null;
      this.ensureServer();
    }, delay);
  },

  /*
   * Single entry point that makes sure the web UI runs:
   *   - already ours          -> do nothing
   *   - held by somebody else -> leave it alone, re-check in a minute
   *   - port is free          -> start it
   */
  ensureServer: function () {
    if (this.stopping || !this.config) {
      return;
    }
    if (this.pyProcess && !this.pyProcess.terminated) {
      return;
    }
    if (this.serverTimer) {
      return;
    }

    const host = this.config.host || "0.0.0.0";
    const port = Number(this.config.port) || 5000;

    this.resolveBindHost(host).then((bindHost) => {
      this.portInUse(port, bindHost).then((busy) => {
        if (busy) {
          if (!this.occupiedLogged) {
            Log.info(`[MMM-FastNotes] Web UI is already served on ${bindHost}:${port}, skipping own start.`);
            this.occupiedLogged = true;
          }
          this.scheduleCheck(OCCUPIED_RECHECK_DELAY);
          return;
        }
        this.occupiedLogged = false;
        this.spawnServer(bindHost, port);
      }).catch((err) => {
        Log.error(`[MMM-FastNotes] Port check for ${bindHost}:${port} failed: ${err}`);
        this.scheduleCheck(OCCUPIED_RECHECK_DELAY);
      });
    });
  },

  /*
   * Resolve which Python binary to run the Flask backend with.
   *
   * Priority:
   *   1. explicit pythonPath in config.js (user knows best)
   *   2. the module's own .venv (created by scripts/setup.sh) - keeps the
   *      backend isolated from the system Python, which matters on distros
   *      with PEP 668 "externally managed" system Pythons
   *   3. plain "python3" from PATH
   */
  resolvePythonPath: function () {
    if (this.config && this.config.pythonPath) {
      return this.config.pythonPath;
    }
    const venvPython = path.join(__dirname, ".venv", "bin", "python3");
    if (fs.existsSync(venvPython)) {
      return venvPython;
    }
    return "python3";
  },

  spawnServer: function (host, port) {
    const options = {
      pythonPath: this.resolvePythonPath(),
      scriptPath: `${__dirname}`,
      args: [
        "--host", host,
        "--port", String(port)
      ]
    };

    try {
      this.pyProcess = new PythonShell("FastNotes.py", options);
    } catch (err) {
      Log.error(`[MMM-FastNotes] Could not start web UI: ${err}`);
      this.planRestart(host, port);
      return;
    }

    this.startedAt = Date.now();

    // An attached "pythonError" listener makes python-shell emit the event
    // instead of throwing, so a failing start cannot take down node_helper.
    this.pyProcess.on("pythonError", (err) => {
      Log.error(`[MMM-FastNotes] Web UI on ${host}:${port} exited with an error: ${err}`);
      this.pyProcess = null;
      this.planRestart(host, port);
    });

    this.pyProcess.on("close", () => {
      const wasRunning = Boolean(this.pyProcess);
      if (wasRunning) {
        Log.log(`[MMM-FastNotes] Web UI process on ${host}:${port} closed.`);
        this.pyProcess = null;
        this.planRestart(host, port);
      }
    });

    const where = host === "::" ? `${host}:${port} (dual-stack: IPv4 + IPv6)` : `${host}:${port}`;
    Log.log(`[MMM-FastNotes] Started web UI on ${where}.`);
  },

  planRestart: function (host, port) {
    if (this.stopping || this.serverTimer) {
      return;
    }

    // A run that lasted a while means the UI was fine - start counting over.
    if (this.startedAt && Date.now() - this.startedAt > ALIVE_AFTER) {
      this.restartAttempts = 0;
    }

    this.restartAttempts += 1;

    let delay;
    if (this.restartAttempts <= MAX_FAST_RESTARTS) {
      delay = FAST_RESTART_DELAY * 2 ** (this.restartAttempts - 1);
      Log.warn(
        `[MMM-FastNotes] Restarting web UI in ${delay}ms ` +
        `(attempt ${this.restartAttempts}/${MAX_FAST_RESTARTS}).`
      );
    } else {
      delay = QUIET_RESTART_DELAY;
      Log.error(
        `[MMM-FastNotes] Web UI keeps failing - retrying quietly every ` +
        `${Math.round(delay / 60000)} minute(s). Check the backend and config.js.`
      );
    }

    this.serverTimer = setTimeout(() => {
      this.serverTimer = null;
      this.ensureServer();
    }, delay);
  },

  readDb: function () {
    // sqlite3 failed to load at startup (see top of file) - skip quietly, the
    // actionable fix was already logged once.
    if (!sqlite3) {
      return;
    }
    let db = new sqlite3.Database(`${__dirname}/backend/database.db`, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        Log.error(`[MMM-FastNotes] ${err.message}`);
      }
    });

    let sql = `SELECT title Title,
                      content Text,
                      created Date
               FROM posts
               ORDER BY created`;
    db.all(sql, [], (err, rows) => {
      if (err) {
        Log.error(`[MMM-FastNotes] ${err.message}`);
        return;
      }
      this.sendSocketNotification("DATABASE", rows);
    });

    db.close((err) => {
      if (err) {
        Log.error(`[MMM-FastNotes] ${err.message}`);
      }
    });
  },
});
