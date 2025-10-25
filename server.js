import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";

dotenv.config();

// ---------------------
// Express & Path
// ---------------------
const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------
// PostgreSQL Pool
// ---------------------
// Render/Postgres için SSL gereklidir. (require:true, rejectUnauthorized:false)
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

// DB bağlantısını test et + tabloyu otomatik kur
async function initDB() {
  const client = await pool.connect();
  try {
    console.log("✅ PostgreSQL bağlantısı başarılı");
    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        baslik VARCHAR(255) NOT NULL,
        icerik TEXT NOT NULL,
        yazar VARCHAR(100) NOT NULL,
        tarih TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ posts tablosu hazır (varsa tekrar oluşturulmaz)");
  } finally {
    client.release();
  }
}

// ---------------------
// Middleware
// ---------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "pages"))); // varsa görseller vs.
app.use(
  session({
    secret: "supersecretkey", // dilersen ENV’ye taşıyabilirsin
    resave: false,
    saveUninitialized: true,
  })
);

// Giriş kontrol
function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

// ---------------------
// Tema (CSS + küçük JS)
// ---------------------
const themeCSS = `
<style>
  :root { --bg:#0d1117; --card:#161b22; --text:#f0f6fc; --muted:#8b949e; --primary:#58a6ff; --danger:#f85149; }
  body { background:var(--bg); color:var(--text); font-family: Arial, Helvetica, sans-serif; margin:0; padding:0; transition:background .5s,color .5s; }
  header { background:#111; color:#fff; padding:16px; display:flex; align-items:center; justify-content:space-between; }
  header h1, header h2 { margin:0; font-size:20px; }
  .container { max-width:900px; margin:24px auto; padding:20px; background:var(--card); border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,.35); }
  a { color:var(--primary); text-decoration:none; }
  .btn { background:var(--primary); color:#fff; border:none; padding:10px 14px; border-radius:8px; cursor:pointer; }
  .btn-outline { background:transparent; border:1px solid var(--primary); color:var(--primary); }
  .btn-danger { background:var(--danger); }
  input, textarea { width:100%; background:#0b1220; color:#fff; border:1px solid #263045; padding:10px; border-radius:8px; margin:6px 0 12px; }
  .post { background:#0f1625; border:1px solid #263045; border-radius:10px; padding:14px; margin:14px 0; }
  .muted { color:var(--muted); font-size:12px; }
  footer { text-align:center; color:var(--muted); padding:16px; }
  .light { --bg:#f7f8fb; --card:#ffffff; --text:#0a0a0a; --muted:#5a5f6a; --primary:#1f6feb; --danger:#d21f1f; }
  @keyframes fadeIn { from {opacity:.0; transform:translateY(6px);} to {opacity:1; transform:none;} }
  .fade { animation:fadeIn .35s ease; }
</style>
<script>
  function toggleTheme(){
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
  }
  window.addEventListener('load', () => {
    if(localStorage.getItem('theme') === 'light') document.body.classList.add('light');
  });
</script>
`;

// ---------------------
// Auth Routes
// ---------------------
app.get("/login", (req, res) => {
  res.send(`
  <html><head><meta charset="utf-8"><title>Yönetici Girişi</title>${themeCSS}</head>
  <body class="fade">
    <header>
      <h2>Emirhan'ın Bloğu</h2>
      <button class="btn btn-outline" onclick="toggleTheme()">🌗 Tema</button>
    </header>
    <div class="container">
      <h3>Yönetici Girişi</h3>
      <form method="POST" action="/login">
        <label>Kullanıcı Adı</label>
        <input name="username" required>
        <label>Şifre</label>
        <input type="password" name="password" required>
        <button class="btn" type="submit">Giriş Yap</button>
      </form>
      <p class="muted">Kullanıcı: <b>sa</b> — Şifre: <b>Emirhan.</b></p>
    </div>
    <footer>© 2025 Emirhan Mezarcı | Nişantaşı Üniversitesi Bilgisayar Programcılığı</footer>
  </body></html>
  `);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "sa" && password === "Emirhan.") {
    req.session.loggedIn = true;
    res.redirect("/");
  } else {
    res.send(`
      <html><head><meta charset="utf-8"><title>Hatalı Giriş</title>${themeCSS}</head>
      <body class="fade">
        <header><h2>Hata</h2><button class="btn btn-outline" onclick="toggleTheme()">🌗 Tema</button></header>
        <div class="container"><p>❌ Hatalı kullanıcı adı veya şifre.</p><a class="btn btn-outline" href="/login">Tekrar Dene</a></div>
      </body></html>
    `);
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ---------------------
// Pages
// ---------------------
app.get("/", requireLogin, (req, res) => {
  res.send(`
  <html><head><meta charset="utf-8"><title>Ana Sayfa</title>${themeCSS}</head>
  <body class="fade">
    <header>
      <h1>Emirhan'ın Bloğu</h1>
      <div>
        <button class="btn btn-outline" onclick="toggleTheme()">🌗 Tema</button>
        <a href="/logout" class="btn" style="margin-left:8px;">Çıkış Yap</a>
      </div>
    </header>
    <div class="container">
      <p>Hoş geldin Emirhan 👋</p>
      <p>
        <a class="btn" href="/posts">📜 Yazıları Gör</a>
        <a class="btn btn-outline" style="margin-left:8px;" href="/add-post">📝 Yeni Yazı Ekle</a>
      </p>
    </div>
    <footer>
      GitHub: <a href="https://github.com/333mirrr">333mirrr</a> •
      📧 emirhanmezarci34@gmail.com •
      📱 05332180817 •
      🎓 Nişantaşı Üniversitesi Bilgisayar Programcılığı
    </footer>
  </body></html>
  `);
});

app.get("/posts", requireLogin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");
    let html = `
    <html><head><meta charset="utf-8"><title>Yazılar</title>${themeCSS}</head>
    <body class="fade">
      <header>
        <h2>Tüm Yazılar</h2>
        <div>
          <button class="btn btn-outline" onclick="toggleTheme()">🌗 Tema</button>
          <a class="btn" style="margin-left:8px;" href="/add-post">Yeni Yazı</a>
          <a class="btn btn-outline" style="margin-left:8px;" href="/">Ana Sayfa</a>
        </div>
      </header>
      <div class="container">
    `;
    if (result.rows.length === 0) {
      html += `<p class="muted">Henüz yazı yok. “Yeni Yazı” ile başlayabilirsin.</p>`;
    } else {
      for (const p of result.rows) {
        html += `
          <div class="post">
            <h3>${p.baslik}</h3>
            <p>${p.icerik}</p>
            <p class="muted">Yazar: ${p.yazar} • Tarih: ${new Date(p.tarih).toLocaleString()}</p>
            <form method="POST" action="/delete-post/${p.id}">
              <button class="btn btn-danger" type="submit">Sil</button>
            </form>
          </div>
        `;
      }
    }
    html += `</div><footer>© Emirhan Mezarcı</footer></body></html>`;
    res.send(html);
  } catch (err) {
    console.error("GET /posts hata:", err);
    res.status(500).send("⚠️ Yazılar alınamadı: " + err.message);
  }
});

app.get("/add-post", requireLogin, (req, res) => {
  res.send(`
  <html><head><meta charset="utf-8"><title>Yeni Yazı</title>${themeCSS}</head>
  <body class="fade">
    <header><h2>Yeni Yazı Ekle</h2><button class="btn btn-outline" onclick="toggleTheme()">🌗 Tema</button></header>
    <div class="container">
      <form method="POST" action="/add-post">
        <label>Başlık</label>
        <input name="baslik" required>
        <label>İçerik</label>
        <textarea name="icerik" rows="6" required></textarea>
        <input type="hidden" name="yazar" value="Emirhan">
        <button class="btn" type="submit">Kaydet</button>
        <a class="btn btn-outline" style="margin-left:8px;" href="/posts">Geri</a>
      </form>
    </div>
  </body></html>
  `);
});

app.post("/add-post", requireLogin, async (req, res) => {
  const { baslik, icerik, yazar } = req.body;
  try {
    await pool.query(
      "INSERT INTO posts (baslik, icerik, yazar, tarih) VALUES ($1,$2,$3,NOW())",
      [baslik, icerik, yazar]
    );
    res.redirect("/posts");
  } catch (err) {
    console.error("POST /add-post hata:", err);
    res.status(500).send("⚠️ Yazı eklenemedi: " + err.message);
  }
});

app.post("/delete-post/:id", requireLogin, async (req, res) => {
  try {
    await pool.query("DELETE FROM posts WHERE id=$1", [req.params.id]);
    res.redirect("/posts");
  } catch (err) {
    console.error("POST /delete-post hata:", err);
    res.status(500).send("⚠️ Silinemedi: " + err.message);
  }
});

// ---------------------
// 404 → login (girişsiz) / ana sayfa (girişliyse)
// ---------------------
app.use((req, res) => {
  if (req.session?.loggedIn) return res.redirect("/");
  res.redirect("/login");
});

// ---------------------
// Start
// ---------------------
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server ${PORT} portunda çalışıyor`));
  })
  .catch((e) => {
    console.error("❌ DB init hata:", e);
    // yine de server’ı ayağa kaldır, logs’tan bakarız
    app.listen(PORT, () => console.log(`🚀 Server ${PORT} portunda (DB init hatasıyla) başladı`));
  });
