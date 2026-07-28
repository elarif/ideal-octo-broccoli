import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
