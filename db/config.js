import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

export async function connectDB() {
  try {
    const pool = await sql.connect(config);
    console.log("✅ SQL bağlantısı başarılı");
    return pool;
  } catch (err) {
    console.error("❌ Veritabanı bağlantı hatası:", err);
  }
}
