import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";

declare const __D1_MIGRATIONS__: D1Migration[];

await applyD1Migrations(env.DB, __D1_MIGRATIONS__);
