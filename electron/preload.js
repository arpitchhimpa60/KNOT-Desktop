
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("knotDesktop", {
  // Window controls
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),

  // Application controls
  quit: () => ipcRenderer.invoke("app:quit"),
  confirmQuit: () => ipcRenderer.invoke("app:confirm-quit"),

  // Application information
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  getPlatform: () => ipcRenderer.invoke("app:get-platform"),

  // Native file selection and saving
  selectFile: () => ipcRenderer.invoke("file:select"),
  saveFile: (payload) => ipcRenderer.invoke("file:save", payload),

  // Theme controls (Dark / Light mode)
  getTheme: () => ipcRenderer.invoke("theme:get"),
  toggleTheme: () => ipcRenderer.invoke("theme:toggle"),
  setTheme: (theme) => ipcRenderer.invoke("theme:set", theme),
  onThemeChange: (callback) => {
    const handler = (_event, themeInfo) => callback(themeInfo);
    ipcRenderer.on("theme:changed", handler);

    return () => {
      ipcRenderer.removeListener("theme:changed", handler);
    };
  },

  // Subscribe to maximize/restore state changes
  onMaximizedChange: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized);

    ipcRenderer.on("window:maximized", handler);

    return () => {
      ipcRenderer.removeListener("window:maximized", handler);
    };
  },
});
