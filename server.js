import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 🌐 PostgreSQL bağlantısı
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
});

pool.connect()
  .then(() => console.log("✅ PostgreSQL bağlantısı başarılı"))
  .catch(err => console.error("❌ PostgreSQL bağlantı hatası:", err));

// 📂 Dizin ayarları
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "pages")));
app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// 🔒 Giriş kontrol middleware
function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

// 🌈 Tema ve animasyonlar
const themeCSS = `
<style>
  body { background: var(--bg); color: var(--text); font-family: Arial; transition: background 0.6s, color 0.6s; margin:0; padding:0;}
  header { background:#111; color:white; padding:15px; display:flex; justify-content:space-between; align-items:center; }
  a { color:#58a6ff; text-decoration:none; }
  button { background:#58a6ff; border:none; padding:8px 15px; border-radius:6px; color:white; cursor:pointer; }
  .container { padding:30px; max-width:800px; margin:auto; }
  .post { border:1px solid #333; border-radius:8px; padding:15px; background:#161b22; margin-bottom:15px; }
  footer { background:#111; color:white; text-align:center; padding:10px; margin-top:20px; font-size:13px;}
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

// 🔐 Giriş sayfası
app.get("/login", (req, res) => {
  res.send(`
    <html><head><title>Yönetici Girişi</title>${themeCSS}</head>
    <body class="fade">
      <header><h2>Emirhan'ın Bloğu</h2><button onclick="toggleTheme()">🌗 Tema</button></header>
      <div class="container">
        <h3>Yönetici Girişi</h3>
        <form method="POST" action="/login">
          <label>Kullanıcı Adı:</label><br><input type="text" name="username" required><br><br>
          <label>Şifre:</label><br><input type="password" name="password" required><br><br>
          <button type="submit">Giriş Yap</button>
        </form>
      </div>
      <footer>© 2025 Emirhan Mezarcı | Tüm Hakları Saklıdır</footer>
    </body></html>
  `);
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

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// 🏠 Ana Sayfa
app.get("/", requireLogin, (req, res) => {
  res.send(`
    <html><head><title>Emirhan'ın Bloğu</title>${themeCSS}</head>
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
        <p><a href="/posts">📜 Yazıları Gör</a> | <a href="/add-post">📝 Yeni Yazı Ekle</a></p>
      </div>
      <footer>
        GitHub: <a href="https://github.com/333mirrr">333mirrr</a> |
        © 2025 Emirhan Mezarcı | Nişantaşı Üniversitesi Bilgisayar Programcılığı
      </footer>
    </body></html>
  `);
});

// 📜 Yazılar Sayfası
app.get("/posts", requireLogin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");
    let html = `
      <html><head><title>Yazılar</title>${themeCSS}</head>
      <body class="fade">
        <header><h2>Yazılar</h2><button onclick="toggleTheme()">🌗 Tema</button></header>
        <div class="container">
          <a href="/add-post">Yeni Yazı Ekle</a> | <a href="/">Ana Sayfa</a><hr>
    `;
    result.rows.forEach((p) => {
      html += `
        <div class="post">
          <h3>${p.baslik}</h3>
          <p>${p.icerik}</p>
          <small>Yazar: ${p.yazar} | Tarih: ${new Date(p.tarih).toLocaleDateString()}</small><br>
          <form method="POST" action="/delete-post/${p.id}">
            <button style="background:red;margin-top:8px;">Sil</button>
          </form>
        </div>`;
    });
    html += "</div><footer>© Emirhan Mezarcı</footer></body></html>";
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

// ➕ Yeni Yazı Sayfası
app.get("/add-post", requireLogin, (req, res) => {
  res.send(`
    <html><head><title>Yeni Yazı</title>${themeCSS}</head>
    <body class="fade">
      <header><h2>Yeni Yazı Ekle</h2><button onclick="toggleTheme()">🌗 Tema</button></header>
      <div class="container">
        <form method="POST" action="/add-post">
          <label>Başlık:</label><br><input type="text" name="baslik" required><br><br>
          <label>İçerik:</label><br><textarea name="icerik" rows="5" cols="50" required></textarea><br><br>
          <input type="hidden" name="yazar" value="Emirhan">
          <button type="submit">Kaydet</button>
        </form>
        <br><a href="/posts">Geri Dön</a>
      </div>
      <footer>© Emirhan Mezarcı</footer>
    </body></html>
  `);
});

// ✏️ Yazı Ekleme
app.post("/add-post", requireLogin, async (req, res) => {
  const { baslik, icerik, yazar } = req.body;
  try {
    await pool.query("INSERT INTO posts (baslik, icerik, yazar, tarih) VALUES ($1,$2,$3,NOW())", [baslik, icerik, yazar]);
    res.redirect("/posts");
  } catch (err) {
    console.error(err);
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

// 🗑️ Yazı Silme
app.post("/delete-post/:id", requireLogin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM posts WHERE id=$1", [id]);
    res.redirect("/posts");
  } catch (err) {
    res.status(500).send("Silme hatası: " + err.message);
  }
});

// 🚀 Server Başlat
app.listen(PORT, () => console.log(`🚀 Server ${PORT} portunda çalışıyor`));
