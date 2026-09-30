import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the static build works from any path (GitHub Pages, a tunnel, a CDN folder).
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5173 },
});
