import { Tray, Menu, nativeImage, BrowserWindow, app } from "electron";
import { join } from "path";

export function createTray(mainWindow: BrowserWindow | null): Tray {
  // Load the tray icon from resources folder
  // "Template" suffix tells macOS to treat it as a template image (auto dark/light mode)
  // In dev: out/main -> resources (../resources)
  // In prod: same structure after packaging
  const iconPath = join(__dirname, "../resources/trayTemplate.png");
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
          mainWindow.webContents.send("navigate", "/settings");
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
