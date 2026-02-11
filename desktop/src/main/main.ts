/**
 * UAS Desktop — Electron Main Process
 *
 * Creates the main browser window, registers IPC handlers,
 * and manages the application lifecycle.
 */

import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import { registerIpcHandlers, cleanupEngine } from "./ipc";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "UAS — Universal App Store",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load the renderer HTML
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  // Open DevTools in development
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Register all IPC handlers before creating the window
  await registerIpcHandlers();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", async () => {
  await cleanupEngine();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  dialog.showErrorBox("Error", error.message);
});
