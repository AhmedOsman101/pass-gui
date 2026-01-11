import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import neutralino from "vite-plugin-neutralino";
import vueDevTools from "vite-plugin-vue-devtools";

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    neutralino({
      // Point to the project root
      rootPath: new URL("..", import.meta.url).pathname,
    }),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      // Point to client/src directory
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
