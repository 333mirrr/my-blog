import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// PostgreSQL bağlantısı
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log("✅ PostgreSQL bağlantısı başarılı"))
  .catch(err => console.error("❌ PostgreSQL bağlantı hatası:", err));

// Dizin ayarları
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "pages")));
app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: true
}));

// 🔐 Giriş kontrol
function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

// 🎨 Tema & Stil
const theme = `
<style>
  body { background:#0d1117; color:#f0f6fc; font-family:Arial; margin:0; padding:0; transition:all 0.5s ease; }
  header { background:#111; color:#fff; padding:15px; display:flex; justify-content:space-between; align-items:center; }
  .container { max-width:800px; margin:30px auto; padding:20px; background:#161b22; border-radius:10px; }
  input, textarea { width:100%; padding:10px; margin:6px 0; border-radius:6px; border:none; }
  button { background:#58a6ff; color:#fff; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; }
  a { color:#58a6ff; text-decoration:none; }
  footer { background:#111; color:#999; text-align:center; padding:15px; font-size:13px; margin-top:20px; }
  .light { background:white; color:black; }
  @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
  .fade { animation: fadeIn 1s ease; }
</style>
<script>
function toggleTheme() {
  document.body.classList.toggle('light');
  localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
}
window.onload = () => {
  if (localStorage.getItem('theme') === 'light') document.body.classList.add('light');
};
</script>
`;

// 🧭 Giriş Sayfası
app.get("/login", (req, res) => {
  res.send(`
  <html><head><title>Yönetici Girişi</title>${theme}</head>
  <body class="fade">
    <header><h2>Emirhan'ın Bloğu</h2><button onclick="toggleTheme()">🌙 Tema</button></header>
    <div class="container">
      <h3>Yönetici Girişi</h3>
      <form method="POST" action="/login">
        <label>Kullanıcı Adı:</label><br><input name="username" required>
        <label>Şifre:</label><br><input type="password" name="password" required>
        <br><button>Giriş Yap</button>
      </form>
    </div>
    <footer>© 2025 Emirhan Mezarcı | Tüm Hakları Saklıdır</footer>
  </body></html>`);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "sa" && password === "Emirhan.") {
    req.session.loggedIn = true;
    res.redirect("/");
  } else {
    res.send("<p>❌ Hatalı giriş!</p><a href='/login'>Tekrar Dene</a>");
  }
});

// 🏠 Ana Sayfa
app.get("/", requireLogin, (req, res) => {
  res.send(`
  <html><head><title>Ana Sayfa</title>${theme}</head>
  <body class="fade">
    <header>
      <h2>Emirhan'ın Bloğu</h2>
      <div>
        <button onclick="toggleTheme()">🌗 Tema</button>
        <a href="/logout"><button>Çıkış Yap</button></a>
      </div>
    </header>
    <div class="container">
      <h3>Hoş geldin Emirhan 👋</h3>
      <p><a href="/posts">📜 Yazılar</a> | <a href="/add-post">📝 Yeni Yazı Ekle</a></p>
    </div>
    <footer>GitHub: <a href="https://github.com/333mirrr">333mirrr</a> | © 2025</footer>
  </body></html>`);
});

// 📜 Yazılar
app.get("/posts", requireLogin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");
    let html = `
    <html><head><title>Yazılar</title>${theme}</head><body class="fade">
    <header><h2>Yazılar</h2><button onclick="toggleTheme()">🌙 Tema</button></header>
    <div class="container"><a href="/add-post">Yeni Yazı Ekle</a> | <a href="/">Ana Sayfa</a><hr>`;
    result.rows.forEach(p => {
      html += `
      <div style="margin-bottom:15px;">
        <h3>${p.baslik}</h3>
        <p>${p.icerik}</p>
        <small>${new Date(p.tarih).toLocaleString()} - ${p.yazar}</small>
        <form method="POST" action="/delete-post/${p.id}">
          <button style="background:red;margin-top:8px;">Sil</button>
        </form>
      </div>`;
    });
    html += "</div><footer>© Emirhan Mezarcı</footer></body></html>";
    res.send(html);
  } catch (err) {
    res.send("⚠️ Yazılar alınamadı: " + err.message);
  }
});

// ➕ Yeni Yazı
app.get("/add-post", requireLogin, (req, res) => {
  res.send(`
  <html><head><title>Yeni Yazı</title>${theme}</head>
  <body class="fade">
    <header><h2>Yeni Yazı Ekle</h2><button onclick="toggleTheme()">🌙 Tema</button></header>
    <div class="container">
      <form method="POST" action="/add-post">
        <label>Başlık:</label><input name="baslik" required>
        <label>İçerik:</label><textarea name="icerik" required></textarea>
        <input type="hidden" name="yazar" value="Emirhan">
        <button>Kaydet</button>
      </form>
      <br><a href="/posts">Geri Dön</a>
    </div>
    <footer>© Emirhan Mezarcı</footer>
  </body></html>`);
});

app.post("/add-post", requireLogin, async (req, res) => {
  const { baslik, icerik, yazar } = req.body;
  try {
    await pool.query("INSERT INTO posts (baslik, icerik, yazar, tarih) VALUES ($1,$2,$3,NOW())", [baslik, icerik, yazar]);
    res.redirect("/posts");
  } catch (err) {
    res.send("⚠️ Yazı eklenemedi: " + err.message);
  }
});

// 🗑️ Silme
app.post("/delete-post/:id", requireLogin, async (req, res) => {
  try {
    await pool.query("DELETE FROM posts WHERE id=$1", [req.params.id]);
    res.redirect("/posts");
  } catch (err) {
    res.send("⚠️ Silinemedi: " + err.message);
  }
});

// 🚪 Çıkış
app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

// 🚀 Server
app.listen(PORT, () => console.log(`🚀 Server ${PORT} portunda çalışıyor`));
