const Database = require('better-sqlite3');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const dbPath = path.join(os.homedir(), '.weston', 'weston.db');
const db = new Database(dbPath);

console.log("Adding test source...");
const sourceId = `src_test_${crypto.randomUUID()}`;
const chatId = "chat-1";
const now = Date.now();

try {
  db.prepare(`
    INSERT INTO sources (id, chat_id, name, kind, status, progress, bytes, is_active, word_count, tokens, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'indexed', 100, 1024, 1, 452, 587, ?, ?)
  `).run(sourceId, chatId, "Test Document.txt", "txt", now, now);
  console.log("Successfully inserted test source with new columns.");
  
  const row = db.prepare("SELECT * FROM sources WHERE id = ?").get(sourceId);
  console.log("Row data:", row);
  
} catch (e) {
  console.error("Migration/Insertion failed:", e);
} finally {
  db.close();
}
