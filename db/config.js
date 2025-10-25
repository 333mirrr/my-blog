import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log("✅ PostgreSQL bağlantısı başarılı (config.js)"))
  .catch(err => console.error("❌ PostgreSQL bağlantı hatası:", err));
