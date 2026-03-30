import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./",
  build: { outDir: "dist" },
  server: {
    port: 3000,
    proxy: {
      "/matchmake": {
        target: "http://localhost:2567",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
