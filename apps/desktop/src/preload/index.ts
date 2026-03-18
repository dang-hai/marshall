import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  onNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on("navigate", (_event, path) => callback(path));
  },
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
});

declare global {
  interface Window {
    electronAPI: {
      platform: string;
      onNavigate: (callback: (path: string) => void) => void;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}
