import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: ".",
  base: "./",
  publicDir: "public",
  build: {
    target: "es2022",
    sourcemap: false,
  },
  server: {
    port: 5173,
    open: true,
  },
  plugins: [viteSingleFile()],
});
