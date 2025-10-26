import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Path ayarları
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL bağlantısı (Render uyumlu)
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

// Bağlantı kontrolü ve tablo oluşturma
async function initDB() {
  try {
    const client = await pool.connect();
    console.log("✅ PostgreSQL bağlantısı başarılı");
    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        baslik VARCHAR(255),
        icerik TEXT,
        yazar VARCHAR(100),
        tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
    console.log("✅ 'posts' tablosu kontrol edildi / oluşturuldu");
  } catch (err) {
    console.error("❌ Veritabanı hatası:", err);
  }
}

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "pages")));
app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// Login kontrol
function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

// Tema CSS + JS
const theme = `
<style>
  :root { --bg:#0d1117; --text:#f0f6fc; --card:#161b22; --accent:#58a6ff; --danger:#f85149; }
  body { background:var(--bg); color:var(--text); font-family:Arial; margin:0; transition:all .3s ease; }
  header { background:#111; padding:15px; display:flex; justify-content:space-between; align-items:center; color:#fff; }
  .container { max-width:900px; margin:30px auto; padding:20px; background:var(--card); border-radius:12px; box-shadow:0 0 10px #0005; }
  button { background:var(--accent); color:white; border:none; border-radius:6px; padding:10px 15px; cursor:pointer; }
  input, textarea { width:100%; padding:10px; border-radius:6px; border:1px solid #333; margin-bottom:10px; background:#0b1220; color:white; }
  .post { border:1px solid #333; border-radius:10px; padding:15px; margin:10px 0; background:#0f1625; }
  footer { text-align:center; color:#888; margin-top:40px; padding:20px; font-size:13px; }
  .light { --bg:#fff; --text:#000; --card:#f3f3f3; }
  @keyframes fadeIn { from {opacity:0; transform:translateY(10px);} to {opacity:1; transform:none;} }
  .fade { animation:fadeIn .4s ease; }
</style>
<script>
  function toggleTheme(){
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
  }
  window.onload=()=>{ if(localStorage.getItem('theme')==='light')document.body.classList.add('light'); };
</script>
`;

// Login sayfası
app.get("/login", (req, res) => {
  res.send(`
  <html><head><meta charset="utf-8"><title>Giriş</title>${theme}</head>
  <body class="fade">
    <header><h2>Emirhan'ın Bloğu</h2><button onclick="toggleTheme()">🌗 Tema</button></header>
    <div class="container">
      <h3>Yönetici Girişi</h3>
      <form method="POST" action="/login">
        <label>Kullanıcı Adı</label>
        <input name="username" required>
        <label>Şifre</label>
        <input type="password" name="password" required>
        <button>Giriş Yap</button>
      </form>
    </div>
    <footer>© 2025 Emirhan Mezarcı</footer>
  </body></html>
  `);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "sa" && password === "Emirhan.") {
    req.session.loggedIn = true;
    res.redirect("/");
  } else {
    res.send("<p>❌ Hatalı kullanıcı adı veya şifre</p><a href='/login'>Tekrar dene</a>");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Ana sayfa
app.get("/", requireLogin, (req, res) => {
  res.send(`
  <html><head><meta charset="utf-8"><title>Ana Sayfa</title>${theme}</head>
  <body class="fade">
    <header>
      <h2>Emirhan'ın Bloğu</h2>
      <div><button onclick="toggleTheme()">🌗 Tema</button> <a href="/logout"><button>Çıkış</button></a></div>
    </header>
    <div class="container">
      <p>Hoş geldin Emirhan 👋</p>
      <a href="/posts"><button>Yazıları Gör</button></a>
      <a href="/add-post"><button>Yeni Yazı Ekle</button></a>
    </div>
  </body></html>
  `);
});

// Yazılar sayfası
app.get("/posts", requireLogin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");
    let html = `
    <html><head><meta charset="utf-8"><title>Yazılar</title>${theme}</head>
    <body class="fade">
    <header><h2>Yazılar</h2><button onclick="toggleTheme()">🌗 Tema</button></header>
    <div class="container">
    `;
    if (result.rows.length === 0) html += `<p>Henüz yazı yok</p>`;
    else {
      for (const p of result.rows) {
        html += `
        <div class="post">
          <h3>${p.baslik}</h3>
          <p>${p.icerik}</p>
          <small>Yazar: ${p.yazar} | Tarih: ${new Date(p.tarih).toLocaleDateString()}</small>
          <form method="POST" action="/delete-post/${p.id}">
            <button style="background:#f85149;">Sil</button>
          </form>
        </div>`;
      }
    }
    html += `<a href="/add-post"><button>Yeni Yazı</button></a><a href="/"><button>Ana Sayfa</button></a></div></body></html>`;
    res.send(html);
  } catch (err) {
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

// Yazı ekleme
app.get("/add-post", requireLogin, (req, res) => {
  res.send(`
  <html><head><meta charset="utf-8"><title>Yeni Yazı</title>${theme}</head>
  <body class="fade">
  <header><h2>Yeni Yazı</h2><button onclick="toggleTheme()">🌗 Tema</button></header>
  <div class="container">
    <form method="POST" action="/add-post">
      <label>Başlık</label>
      <input name="baslik" required>
      <label>İçerik</label>
      <textarea name="icerik" required></textarea>
      <input type="hidden" name="yazar" value="Emirhan">
      <button>Kaydet</button>
    </form>
    <a href="/posts"><button>Ana Sayfa</button></a>
  </div>
  </body></html>
  `);
});

app.post("/add-post", requireLogin, async (req, res) => {
  const { baslik, icerik, yazar } = req.body;
  try {
    await pool.query("INSERT INTO posts (baslik, icerik, yazar) VALUES ($1, $2, $3)", [
      baslik,
      icerik,
      yazar,
    ]);
    res.redirect("/posts");
  } catch (err) {
    res.status(500).send("Ekleme hatası: " + err.message);
  }
});

// Silme
app.post("/delete-post/:id", requireLogin, async (req, res) => {
  try {
    await pool.query("DELETE FROM posts WHERE id=$1", [req.params.id]);
    res.redirect("/posts");
  } catch (err) {
    res.status(500).send("Silme hatası: " + err.message);
  }
});

// 404
app.use((req, res) => {
  res.redirect("/login");
});

// Server başlat
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server ${PORT} portunda çalışıyor`));
});
