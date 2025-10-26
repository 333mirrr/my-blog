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
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log("✅ PostgreSQL bağlantısı başarılı"))
  .catch(err => console.error("❌ PostgreSQL bağlantı hatası:", err));

// Dizin ayarları
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // banner için

// Session
app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: true
}));

// Giriş kontrolü sadece yönetici işlemleri için
function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

// Tema CSS + Script
const themeCSS = `
<style>
  body { background: var(--bg); color: var(--text); font-family: Arial; transition: background 0.6s, color 0.6s; margin:0; padding:0;}
  header { background:#111; color:white; padding:15px; display:flex; justify-content:space-between; align-items:center; }
  a { color:#58a6ff; text-decoration:none; }
  button { background:#58a6ff; border:none; padding:8px 15px; border-radius:6px; color:white; cursor:pointer; }
  .container { padding:30px; max-width:900px; margin:auto; }
  .post { border:1px solid #333; border-radius:8px; padding:15px; background:#161b22; margin-bottom:15px; }
  footer { background:#111; color:white; text-align:center; padding:15px; margin-top:20px; font-size:13px;}
  .banner { width:100%; height:300px; background:url('/banner.jpg') center/cover; display:flex; justify-content:center; align-items:center; color:white; font-size:28px; font-weight:bold; }
  :root { --bg:#0d1117; --text:#f0f6fc; }
  .light { --bg:white; --text:black; }
  .fade { animation: fadeIn 0.8s ease; }
  @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
</style>
<script>
  function toggleTheme(){
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
  }
  window.onload = () => {
    if(localStorage.getItem('theme')==='light') document.body.classList.add('light');
  };
</script>
`;

// 🏠 Herkese açık anasayfa
app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");
    let html = `
      <html><head><title>Emirhan'ın Bloğu</title>${themeCSS}</head>
      <body class="fade">
        <header>
          <h2>Emirhan'ın Bloğu</h2>
          <div>
            <button onclick="toggleTheme()">🌗 Tema</button>
            ${req.session.loggedIn ? "<a href='/logout'><button>Çıkış</button></a>" : "<a href='/login'><button>Giriş</button></a>"}
          </div>
        </header>
        <div class="banner">Merhaba! Ben Emirhan Mezarcı 👋</div>
        <div class="container">
          <h3>📖 Son Yazılar</h3>
    `;
    if (result.rows.length === 0) {
      html += "<p>Henüz yazı eklenmemiş.</p>";
    } else {
      result.rows.forEach(p => {
        html += `
          <div class="post">
            <h3>${p.baslik}</h3>
            <p>${p.icerik}</p>
            <small>✍️ ${p.yazar} • ${new Date(p.tarih).toLocaleDateString()}</small>
          </div>`;
      });
    }
    html += `
        </div>
        <footer>
          <p>📧 emirhanmezarci34@gmail.com | 📱 0533 218 08 17</p>
          <p>🎓 Nişantaşı Üniversitesi - Bilgisayar Programcılığı Mezunu</p>
          <p>GitHub: <a href="https://github.com/333mirrr">333mirrr</a></p>
        </footer>
      </body></html>
    `;
    res.send(html);
  } catch (err) {
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

// 🔐 Login
app.get("/login", (req, res) => {
  res.send(`
    <html><head><title>Giriş Yap</title>${themeCSS}</head>
    <body class="fade">
      <header><h2>Yönetici Girişi</h2></header>
      <div class="container">
        <form method="POST" action="/login">
          <label>Kullanıcı Adı:</label><br><input type="text" name="username" required><br><br>
          <label>Şifre:</label><br><input type="password" name="password" required><br><br>
          <button type="submit">Giriş Yap</button>
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
    res.redirect("/admin");
  } else {
    res.send("<p>❌ Hatalı giriş!</p><a href='/login'>Tekrar Dene</a>");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// 🧠 Yönetici paneli (sadece giriş yapan görebilir)
app.get("/admin", requireLogin, (req, res) => {
  res.send(`
    <html><head><title>Yönetici Paneli</title>${themeCSS}</head>
    <body class="fade">
      <header><h2>Yönetici Paneli</h2></header>
      <div class="container">
        <p><a href="/add-post"><button>📝 Yeni Yazı Ekle</button></a> <a href="/"><button>Ana Sayfa</button></a></p>
      </div>
    </body></html>
  `);
});

// ✏️ Yazı ekleme
app.get("/add-post", requireLogin, (req, res) => {
  res.send(`
    <html><head><title>Yeni Yazı</title>${themeCSS}</head>
    <body class="fade">
      <header><h2>Yeni Yazı Ekle</h2></header>
      <div class="container">
        <form method="POST" action="/add-post">
          <label>Başlık:</label><br><input type="text" name="baslik" required><br><br>
          <label>İçerik:</label><br><textarea name="icerik" rows="5" cols="50" required></textarea><br><br>
          <input type="hidden" name="yazar" value="Emirhan">
          <button type="submit">Kaydet</button>
        </form>
        <br><a href="/admin">Geri Dön</a>
      </div>
      <footer>© Emirhan Mezarcı</footer>
    </body></html>
  `);
});

app.post("/add-post", requireLogin, async (req, res) => {
  const { baslik, icerik, yazar } = req.body;
  try {
    await pool.query("INSERT INTO posts (baslik, icerik, yazar, tarih) VALUES ($1,$2,$3,NOW())", [baslik, icerik, yazar]);
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

// 🚀 Server başlat
app.listen(PORT, () => console.log(`🚀 Server ${PORT} portunda çalışıyor`));
