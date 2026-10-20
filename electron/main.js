
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  utilityProcess,
  nativeTheme,
} = require("electron");

const path = require("path");
const fs = require("fs");
const net = require("net");

let mainWindow = null;
let backendProcess = null;

// 1. Check if we are running in development (coding) or as an installed app
const isDev = !app.isPackaged;

// Check if a port is already active on localhost
function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

// 2. Automatically start the backend server in the background
async function startBackend() {
  // If the backend is already running, do nothing
  if (backendProcess) return;

  // If backend is already running on port 5001 (e.g. started via terminal), use it
  const alreadyRunning = await isPortInUse(5001);
  if (alreadyRunning) {
    console.log("Backend server is already running on port 5001.");
    return;
  }

  // Find where server.js is located on the computer
  let serverPath;
  if (isDev) {
    // In development mode: server.js is in the "../server" folder
    serverPath = path.join(__dirname, "../server/server.js");
  } else {
    // In packaged app mode: server.js is inside the app's resources folder
    serverPath = path.join(process.resourcesPath, "server/server.js");
  }

  // Run server.js as a background process on port 5001
  backendProcess = utilityProcess.fork(serverPath, [], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      PORT: "5001",
    },
    stdio: "inherit",
  });

  backendProcess.on("spawn", () => {
    console.log("Backend server started successfully.");
  });

  backendProcess.on("exit", (code) => {
    console.log("Backend server stopped with exit code:", code);
    backendProcess = null;
  });

  backendProcess.on("error", (error) => {
    console.error("Failed to start backend server:", error);
  });
}

// Get the BrowserWindow that sent the IPC request
function getSenderWindow(event) {
  const win = BrowserWindow.fromWebContents(event.sender);

  if (!win || win.isDestroyed()) {
    return null;
  }

  return win;
}

// Minimize
ipcMain.handle("window:minimize", (event) => {
  const win = getSenderWindow(event);
  if (!win) return false;

  win.minimize();
  return true;
});

// Maximize or restore
ipcMain.handle("window:toggle-maximize", (event) => {
  const win = getSenderWindow(event);
  if (!win) return false;

  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }

  return win.isMaximized();
});

// Read maximize state
ipcMain.handle("window:is-maximized", (event) => {
  const win = getSenderWindow(event);

  return Boolean(win && win.isMaximized());
});

// Quit without confirmation
ipcMain.handle("app:quit", () => {
  app.quit();
  return true;
});

// Ask before quitting
ipcMain.handle("app:confirm-quit", async (event) => {
  const win = getSenderWindow(event);
  if (!win) return false;

  const result = await dialog.showMessageBox(win, {
    type: "question",
    buttons: ["Cancel", "Quit KNOT"],
    defaultId: 0,
    cancelId: 0,
    title: "Quit KNOT",
    message: "Are you sure you want to quit KNOT?",
    detail: "Your local session will be closed.",
  });

  if (result.response !== 1) {
    return false;
  }

  app.quit();
  return true;
});

// ==========================================================================
// Theme Handling with nativeTheme and IPC (Dark / Light Mode)
// ==========================================================================

// Get current theme state
ipcMain.handle("theme:get", () => {
  return {
    themeSource: nativeTheme.themeSource,
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  };
});

// Toggle between light and dark mode
ipcMain.handle("theme:toggle", () => {
  if (nativeTheme.shouldUseDarkColors) {
    nativeTheme.themeSource = "light";
  } else {
    nativeTheme.themeSource = "dark";
  }
  return {
    themeSource: nativeTheme.themeSource,
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  };
});

// Set specific theme mode ('light', 'dark', or 'system')
ipcMain.handle("theme:set", (_event, theme) => {
  if (theme === "light" || theme === "dark" || theme === "system") {
    nativeTheme.themeSource = theme;
  }
  return {
    themeSource: nativeTheme.themeSource,
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  };
});

// Broadcast theme changes to all windows (OS change or IPC change)
nativeTheme.on("updated", () => {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send("theme:changed", {
        themeSource: nativeTheme.themeSource,
        shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
      });
    }
  }
});

// App information
ipcMain.handle("app:get-version", () => app.getVersion());

ipcMain.handle("app:get-platform", () => process.platform);

// Native file picker for desktop attachments
ipcMain.handle("file:select", async (event) => {
  const win = getSenderWindow(event) || BrowserWindow.getFocusedWindow();

  try {
    const dialogOptions = {
      title: "Select a file to send",
      properties: ["openFile"],
      filters: [
        {
          name: "All Supported Files",
          extensions: [
            "png", "jpg", "jpeg", "gif", "webp", "svg",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "txt", "md", "csv", "json", "log",
            "zip", "tar", "gz", "7z", "mp3", "wav", "mp4",
          ],
        },
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
        },
        { name: "PDF Documents", extensions: ["pdf"] },
        {
          name: "Documents",
          extensions: [
            "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "txt", "md", "csv", "json",
          ],
        },
        { name: "Archives", extensions: ["zip", "tar", "gz", "7z"] },
        { name: "All Files", extensions: ["*"] },
      ],
    };

    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    const stats = await fs.promises.stat(filePath);
    const fileName = path.basename(filePath);

    // Limit check: 10 MB
    if (stats.size > 10 * 1024 * 1024) {
      return {
        canceled: false,
        error: "File size exceeds 10 MB limit.",
        name: fileName,
        size: stats.size,
      };
    }

    const buffer = await fs.promises.readFile(filePath);
    const uint8 = new Uint8Array(buffer);

    return {
      canceled: false,
      name: fileName,
      size: stats.size,
      data: uint8,
    };
  } catch (error) {
    console.error("Failed to select file:", error);
    return { canceled: true, error: error.message };
  }
});

// Save downloaded file to user-selected location
ipcMain.handle("file:save", async (event, payload) => {
  const win = getSenderWindow(event) || BrowserWindow.getFocusedWindow();

  try {
    const { defaultPath, data } = payload || {};
    const options = {
      title: "Save File As",
      defaultPath: defaultPath || "download",
      buttonLabel: "Save",
      properties: ["showOverwriteConfirmation", "createDirectory"],
    };

    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options);

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    await fs.promises.writeFile(result.filePath, Buffer.from(data));
    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    console.error("Failed to save file:", error);
    return { canceled: true, error: error.message };
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "KNOT",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("maximize", () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("window:maximized", true);
    }
  });

  mainWindow.on("unmaximize", () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("window:maximized", false);
    }
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, url) => {
      console.error("KNOT failed to load:", {
        errorCode,
        errorDescription,
        url,
      });
    }
  );

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(
      path.join(app.getAppPath(), "client/dist/index.html")
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// When Electron is ready: start the backend server, then open the app window
app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// When the user closes the app: stop the background backend server
app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
