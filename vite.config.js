import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        // if your Express routes are not prefixed with /api, uncomment next line:
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
