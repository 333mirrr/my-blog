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

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: true
}));

// 🔐 Giriş kontrolü
function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

// 🎨 Ortak stil
const themeCSS = `
<style>
  :root {
    --bg-dark: #0d1117;
    --text-dark: #f0f6fc;
    --bg-light: #f9f9f9;
    --text-light: #222;
  }

  body {
    background: var(--bg-dark);
    color: var(--text-dark);
    font-family: Arial;
    margin: 0; padding: 0;
    transition: background 0.6s, color 0.6s;
  }

  body.light {
    background: var(--bg-light);
    color: var(--text-light);
  }

  header { background:#111; color:white; padding:15px; display:flex; justify-content:space-between; align-items:center; }
  button { background:#58a6ff; border:none; padding:8px 15px; border-radius:6px; color:white; cursor:pointer; }
  a { color:#58a6ff; text-decoration:none; }
  .container { padding:30px; max-width:900px; margin:auto; }
  .post { border:1px solid #333; border-radius:8px; padding:15px; background:#161b22; margin-bottom:15px; }
  footer { background:#111; color:white; text-align:center; padding:15px; margin-top:20px; font-size:13px; }
  .banner { width:100%; height:300px; background:url('/banner.jpg') center/cover; display:flex; justify-content:center; align-items:center; color:white; font-size:28px; font-weight:bold; }
</style>

<script>
  function toggleTheme(){
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
  }

  window.onload = () => {
    if(localStorage.getItem('theme') === 'light') {
      document.body.classList.add('light');
    }
  }
</script>
`;


// 🏠 Ana Sayfa (herkese açık)
app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");
    let html = `
      <html><head><title>Emirhan'ın Bloğu</title>${themeCSS}</head>
      <body>
        <header>
          <h2>Emirhan'ın Bloğu</h2>
          <div>
            <button onclick="toggleTheme()">🌗 Tema</button>
            ${req.session.loggedIn
              ? `<a href='/logout'><button>Çıkış</button></a>`
              : `<a href='/login'><button>Giriş</button></a>`}
          </div>
        </header>
        <div class="banner">Hoş Geldin! Ben Emirhan Mezarcı 👋</div>
        <div class="container">
          <div style="margin-bottom:20px;">
            <a href="/posts"><button>📜 Yazıları Gör</button></a>
            ${req.session.loggedIn ? `<a href="/add-post"><button>📝 Yazı Ekle</button></a>` : ""}
          </div>
          <h3>📚 Son Yazılar</h3>
    `;

    if (result.rows.length === 0) {
      html += "<p>Henüz yazı eklenmemiş.</p>";
    } else {
      result.rows.forEach(post => {
        html += `
          <div class="post">
            <h3>${post.baslik}</h3>
            <p>${post.icerik}</p>
            <small>✍️ ${post.yazar} • ${new Date(post.tarih).toLocaleDateString()}</small>
            ${
              req.session.loggedIn
                ? `<form method="POST" action="/delete-post/${post.id}" style="margin-top:10px;">
                    <button style="background:red;">🗑️ Sil</button>
                   </form>`
                : ""
            }
          </div>`;
      });
    }

    html += `
        </div>
        <footer>
          <p>📧 emirhanmezarci34@gmail.com | 📱 0533 218 08 17</p>
          <p>🎓 Nişantaşı Üniversitesi - Bilgisayar Programcılığı</p>
          <p>GitHub: <a href="https://github.com/333mirrr">333mirrr</a></p>
        </footer>
      </body></html>
    `;
    res.send(html);
  } catch (err) {
    console.error("Ana sayfa hatası:", err);
    res.status(500).send("Sunucu hatası.");
  }
});

// 🔑 Giriş sayfası
app.get("/login", (req, res) => {
  res.send(`
    <html><head><title>Giriş Yap</title>${themeCSS}</head>
    <body>
      <header><h2>Yönetici Girişi</h2></header>
      <div class="container">
        <form method="POST" action="/login">
          <label>Kullanıcı Adı:</label><br>
          <input type="text" name="username" required><br><br>
          <label>Şifre:</label><br>
          <input type="password" name="password" required><br><br>
          <button type="submit">Giriş Yap</button>
        </form>
      </div>
    </body></html>
  `);
});

// 🔐 Giriş kontrol
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "sa" && password === "Emirhan.") {
    req.session.loggedIn = true;
    res.redirect("/admin");
  } else {
    res.send("<p>❌ Hatalı giriş!</p><a href='/login'>Tekrar dene</a>");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// 🧠 Yönetici Paneli
app.get("/admin", requireLogin, (req, res) => {
  res.send(`
    <html><head><title>Yönetici Paneli</title>${themeCSS}</head>
    <body>
      <header><h2>Yönetici Paneli</h2></header>
      <div class="container">
        <p><a href="/add-post"><button>📝 Yeni Yazı Ekle</button></a> 
        <a href="/"><button>Ana Sayfa</button></a></p>
      </div>
    </body></html>
  `);
});

// ✏️ Yazı ekleme
app.get("/add-post", requireLogin, (req, res) => {
  res.send(`
    <html><head><title>Yeni Yazı</title>${themeCSS}</head>
    <body>
      <header><h2>Yeni Yazı Ekle</h2></header>
      <div class="container">
        <form method="POST" action="/add-post">
          <label>Başlık:</label><br>
          <input type="text" name="baslik" required><br><br>
          <label>İçerik:</label><br>
          <textarea name="icerik" rows="5" cols="50" required></textarea><br><br>
          <input type="hidden" name="yazar" value="Emirhan">
          <button type="submit">Kaydet</button>
        </form>
      </div>
    </body></html>
  `);
});

app.post("/add-post", requireLogin, async (req, res) => {
  const { baslik, icerik, yazar } = req.body;
  try {
    await pool.query(
      "INSERT INTO posts (baslik, icerik, yazar, tarih) VALUES ($1, $2, $3, NOW())",
      [baslik, icerik, yazar]
    );
    res.redirect("/");
  } catch (err) {
    console.error("Yazı ekleme hatası:", err);
    res.status(500).send("Sunucu hatası.");
  }
});

// 🗑️ Yazı silme
app.post("/delete-post/:id", requireLogin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM posts WHERE id=$1", [id]);
    res.redirect("/");
  } catch (err) {
    console.error("Silme hatası:", err);
    res.status(500).send("Silme hatası.");
  }
});
// 📰 Yazıları Gör (herkese açık)
app.get("/posts", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");

    let html = `
      <html><head><title>Tüm Yazılar</title>${themeCSS}</head>
      <body>
        <header>
          <h2>Emirhan'ın Bloğu</h2>
          <div>
            <button onclick="toggleTheme()">🌗 Tema</button>
            <a href="/"><button>Ana Sayfa</button></a>
            ${
              req.session.loggedIn
                ? `<a href="/logout"><button>Çıkış</button></a>`
                : `<a href="/login"><button>Giriş</button></a>`
            }
          </div>
        </header>

        <div class="container">
          <h2>📖 Tüm Yazılar</h2>
    `;

    if (result.rows.length === 0) {
      html += "<p>Henüz yazı eklenmemiş.</p>";
    } else {
      result.rows.forEach(post => {
        html += `
          <div class="post">
            <h3>${post.baslik}</h3>
            <p>${post.icerik}</p>
            <small>✍️ ${post.yazar} • ${new Date(post.tarih).toLocaleDateString()}</small>
          </div>
        `;
      });
    }

    html += `
        </div>
        <footer>
          <p>📧 emirhanmezarci34@gmail.com | 📱 0533 218 08 17</p>
          <p>🎓 Nişantaşı Üniversitesi - Bilgisayar Programcılığı</p>
          <p>GitHub: <a href="https://github.com/333mirrr">333mirrr</a></p>
        </footer>
      </body></html>
    `;

    res.send(html);
  } catch (err) {
    console.error("Yazıları Gör sayfası hatası:", err);
    res.status(500).send("Sunucu hatası.");
  }
});

// 🚀 Başlat
app.listen(PORT, () => console.log(`🚀 Server ${PORT} portunda çalışıyor`));
