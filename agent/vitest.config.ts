import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations("./migrations");

export default defineConfig({
  define: {
    __D1_MIGRATIONS__: JSON.stringify(migrations),
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  test: {
    globals: true,
    setupFiles: ["./test/setup.ts"],
  }
});
