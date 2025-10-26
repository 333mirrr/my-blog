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

// Dizin ayarları
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// Giriş kontrolü
function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

// Tema CSS + animasyon
const themeCSS = `
<style>
  body { font-family: Arial; margin:0; padding:0; background:var(--bg); color:var(--text); transition:0.6s; }
  header { background:#111; color:#fff; padding:15px; display:flex; justify-content:space-between; align-items:center; }
  .container { padding:40px; max-width:800px; margin:auto; text-align:center; }
  button { background:#58a6ff; border:none; padding:10px 15px; border-radius:6px; color:white; cursor:pointer; }
  .light { --bg:white; --text:black; }
  :root { --bg:#0d1117; --text:#f0f6fc; }
  .fade { animation: fadeIn 0.8s ease; }
  @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
  footer { text-align:center; padding:10px; background:#111; color:#ccc; font-size:12px; margin-top:30px; }
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
// 🏠 Ana sayfa (kişisel bilgi görünümü)
app.get("/", requireLogin, (req, res) => {
  res.send(`
    <html><head><title>Emirhan Mezarcı | Kişisel Blog</title>${themeCSS}</head>
    <body class="fade">
      <header>
        <h2>Emirhan Mezarcı</h2>
        <div>
          <button onclick="toggleTheme()">🌗 Tema</button>
          <a href="/logout"><button>Çıkış Yap</button></a>
        </div>
      </header>

      <div class="container">
        <img src="/profile.jpg" alt="Profil Fotoğrafı" style="width:160px;border-radius:50%;box-shadow:0 0 10px #555;">
        <h2>Merhaba, ben Emirhan 👋</h2>
        <p>Yazılım geliştirmeye tutkuyla bağlı bir programcıyım.  
        Kod yazmak, üretmek ve paylaşmak benim yaşam tarzım.</p>
        <hr style="margin:30px 0;">

        <h3>📞 İletişim & Bilgiler</h3>
        <p>
          💻 <strong>GitHub:</strong> <a href="https://github.com/333mirrr" target="_blank">github.com/333mirrr</a><br>
          📧 <strong>E-posta:</strong> <a href="mailto:emirhanmezarci34@gmail.com">emirhanmezarci34@gmail.com</a><br>
          📱 <strong>Telefon:</strong> 0533 218 08 17<br>
          🎓 <strong>Eğitim:</strong> Nişantaşı Üniversitesi - Bilgisayar Programcılığı
        </p>

        <hr style="margin:30px 0;">
        <p><a href="/posts">📜 Yazılarımı Gör</a> | <a href="/add-post">📝 Yeni Yazı Ekle</a></p>
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
    res.send("<p>❌ Hatalı giriş! <a href='/login'>Tekrar dene</a></p>");
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
        <a href="/logout"><button>Çıkış</button></a>
      </div>
    </header>
    <div class="container">
      <h3>Hoş geldin Emirhan 👋</h3>
      <a href="/posts"><button>📜 Yazıları Gör</button></a>
      <a href="/add-post"><button>📝 Yeni Yazı Ekle</button></a>
    </div>
    <footer>© 2025 Emirhan Mezarcı | Nişantaşı Üniversitesi</footer>
  </body></html>
  `);
});

// 📜 Yazılar
app.get("/posts", requireLogin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");
    let html = `
      <html><head><title>Yazılar</title>${themeCSS}</head>
      <body class="fade">
      <header><h2>Yazılar</h2><button onclick="toggleTheme()">🌗 Tema</button></header>
      <div class="container">
      <a href="/">Ana Sayfa</a> | <a href="/add-post">Yeni Yazı</a><hr>
    `;
    result.rows.forEach(p => {
      html += `
        <div style="border:1px solid #333; border-radius:8px; margin:10px; padding:10px;">
          <h3>${p.baslik}</h3>
          <p>${p.icerik}</p>
          <small>${p.yazar} - ${new Date(p.tarih).toLocaleDateString()}</small><br>
          <form method="POST" action="/delete-post/${p.id}">
            <button style="background:red;margin-top:5px;">Sil</button>
          </form>
        </div>`;
    });
    html += "</div></body></html>";
    res.send(html);
  } catch (err) {
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

// ➕ Yazı ekleme formu
app.get("/add-post", requireLogin, (req, res) => {
  res.send(`
    <html><head><title>Yeni Yazı</title>${themeCSS}</head>
    <body class="fade">
      <header><h2>Yeni Yazı Ekle</h2><button onclick="toggleTheme()">🌗 Tema</button></header>
      <div class="container">
        <form method="POST" action="/add-post">
          <input type="text" name="baslik" placeholder="Başlık" required><br><br>
          <textarea name="icerik" placeholder="İçerik" rows="5" cols="50" required></textarea><br><br>
          <input type="hidden" name="yazar" value="Emirhan">
          <button type="submit">Kaydet</button>
        </form>
        <br><a href="/posts">Geri Dön</a>
      </div>
      <footer>© Emirhan Mezarcı</footer>
    </body></html>
  `);
});

app.post("/add-post", requireLogin, async (req, res) => {
  const { baslik, icerik, yazar } = req.body;
  try {
    await pool.query("INSERT INTO posts (baslik, icerik, yazar, tarih) VALUES ($1,$2,$3,NOW())", [baslik, icerik, yazar]);
    res.redirect("/posts");
  } catch (err) {
    res.status(500).send("Ekleme hatası: " + err.message);
  }
});

app.post("/delete-post/:id", requireLogin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM posts WHERE id=$1", [id]);
    res.redirect("/posts");
  } catch (err) {
    res.status(500).send("Silme hatası: " + err.message);
  }
});

// 🟢 Sunucu başlat
app.listen(PORT, () => console.log(`🚀 Server ${PORT} portunda çalışıyor`));
