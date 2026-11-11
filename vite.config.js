import { defineConfig } from "vite";
export default defineConfig(({ command }) => ({
  define: { __DCSMCRAFT_DEV__: JSON.stringify(command === "serve") },
}));
