import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createApp } from "./app.js";
import { openDb } from "./db.js";

const dbPath = resolve(process.env.DB_PATH ?? "data/repairdesk.db");
mkdirSync(dirname(dbPath), { recursive: true });
const port = Number(process.env.PORT ?? 3000);

createApp(openDb(dbPath)).listen(port, () => {
  console.log(`RepairDesk running at http://localhost:${port} (database: ${dbPath})`);
});
