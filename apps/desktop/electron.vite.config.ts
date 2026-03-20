import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync } from "fs";

// Plugin to copy resources to output directory
function copyResourcesPlugin() {
  return {
    name: "copy-resources",
    closeBundle() {
      const resourcesDir = resolve(__dirname, "out/resources");
      if (!existsSync(resourcesDir)) {
        mkdirSync(resourcesDir, { recursive: true });
      }
      const srcResources = resolve(__dirname, "resources");
      if (existsSync(srcResources)) {
        const files = ["trayTemplate.png", "trayTemplate@2x.png"];
        for (const file of files) {
          const src = resolve(srcResources, file);
          if (existsSync(src)) {
            copyFileSync(src, resolve(resourcesDir, file));
          }
        }
      }
    },
  };
}

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        // Bundle these instead of resolving from packaged node_modules.
        // This avoids Bun symlink layout issues where transitive
        // dependency trees are incomplete inside the final app bundle.
        exclude: ["conf", "ws"],
      }),
      copyResourcesPlugin(),
    ],
    define: {
      "process.env.BETTER_AUTH_URL": JSON.stringify(
        process.env.BETTER_AUTH_URL || "http://localhost:3000"
      ),
      "process.env.BACKEND_URL": JSON.stringify(process.env.BACKEND_URL || "http://localhost:3000"),
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@better-auth/electron"],
      }),
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    root: resolve(__dirname, "src/renderer"),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/renderer/index.html"),
        },
      },
    },
  },
});
