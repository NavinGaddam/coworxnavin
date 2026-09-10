import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "coworx-offline-shell",
      writeBundle(options, bundle) {
        const assets = [
          "/",
          "/index.html",
          "/manifest.webmanifest",
          "/favicon.ico",
          "/icons/favicon-16.png",
          "/icons/favicon-32.png",
          "/icons/favicon-48.png",
          "/icons/apple-touch-icon.png",
          "/icons/coworx-192.png",
          "/icons/coworx-512.png",
          "/icons/coworx-cw-192.png",
          "/icons/coworx-cw-512.png",
          "/icons/coworx-maskable-192.png",
          "/icons/coworx-maskable-512.png",
          ...Object.keys(bundle)
            .filter((name) => /\.(js|css|woff2|png|webp|jpg)$/.test(name))
            .map((name) => "/" + name),
        ];
        const version =
          (Object.keys(bundle).find((name) =>
            /^assets\/index-.*\.js$/.test(name),
          ) || "dev") + "-icons-20260910";
        const worker = readFileSync("public/sw.js", "utf8")
          .replace("'coworx-platform-v1'", JSON.stringify("coworx-" + version))
          .replace("self.__COWORX_ASSETS__", JSON.stringify(assets));
        writeFileSync(resolve(options.dir || "dist", "sw.js"), worker);
      },
    },
  ],
});
