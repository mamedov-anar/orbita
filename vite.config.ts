import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vinext()],
  server: { watch: { useFsEvents: false, usePolling: true } },
});
