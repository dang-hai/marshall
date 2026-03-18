import { Tray, Menu, nativeImage, BrowserWindow, app } from "electron";
import { join } from "path";
import { DESKTOP_NAVIGATION_ROUTES } from "../shared/navigation";

export function createTray(mainWindow: BrowserWindow | null): Tray {
  // Load the tray icon
  // "Template" suffix tells macOS to treat it as a template image (auto dark/light mode)
  // In dev: use resources folder relative to __dirname
  // In prod: use extraResources path (process.resourcesPath/tray)
  const isDev = process.env.ELECTRON_RENDERER_URL !== undefined;
  const iconPath = isDev
    ? join(__dirname, "../resources/trayTemplate.png")
    : join(process.resourcesPath, "tray/trayTemplate.png");
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);

  const tray = new Tray(icon);
  tray.setToolTip("Marshall");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Marshall",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      type: "separator",
    },
    {
      label: "Preferences...",
      accelerator: "Command+,",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send("navigate", DESKTOP_NAVIGATION_ROUTES.settings);
        }
      },
    },
    {
      type: "separator",
    },
    {
      label: "Quit Marshall",
      accelerator: "Command+Q",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  return tray;
}
