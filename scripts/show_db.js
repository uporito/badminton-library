const Database = require("better-sqlite3");
const db = new Database("./data/sqlite.db");

console.log("=== TABLES ===\n");
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();
tables.forEach((t) => console.log(t.name));

for (const t of tables) {
  console.log("\n=== " + t.name.toUpperCase() + " ===");
  const cols = db.prepare("PRAGMA table_info(" + t.name + ")").all();
  console.log("Columns:", cols.map((c) => c.name).join(", "));
  const rows = db.prepare("SELECT * FROM " + t.name).all();
  console.log("Rows:", rows.length);
  rows.forEach((r) => console.log(JSON.stringify(r)));
}
db.close();
