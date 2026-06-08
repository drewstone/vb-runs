import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Polyfill Node.js modules for browser compatibility
      process: "process/browser",
    },
  },
  define: {
    "process.env": {},
  },
});
