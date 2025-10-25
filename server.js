import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import session from "express-session";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

pool
  .connect()
  .then(() => console.log("✅ PostgreSQL bağlantısı başarılı"))
  .catch((err) => console.error("❌ PostgreSQL bağlantı hatası:", err));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallbackSecret",
    resave: false,
    saveUninitialized: true,
  })
);

function requireLogin(req, res, next) {
  if (req.session?.loggedIn) return next();
  return res.redirect("/login");
}

// 🌈 Tema ve stil
const theme = `
<style>
  :root{--bg:#0d1117;--panel:#111823;--text:#f0f6fc;--muted:#8b949e;--brand:#58a6ff;--danger:#f85149;}
  body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,Arial;transition:.6s}
  .wrap{max-width:900px;margin:0 auto;padding:28px}
  header{background:#111;display:flex;justify-content:space-between;align-items:center;padding:16px 28px;position:sticky;top:0;z-index:5}
  a{color:var(--brand);text-decoration:none}
  .btn{background:var(--brand);color:#fff;border:none;border-radius:10px;padding:8px 14px;cursor:pointer}
  .btn.out{background:transparent;border:1px solid #333;color:var(--text)}
  .btn.danger{background:var(--danger)}
  .card{background:var(--panel);border-radius:12px;padding:16px;margin:14px 0;border:1px solid #21262d}
  footer{padding:16px;text-align:center;color:var(--muted)}
  .fade{animation:fade .5s ease}@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
</style>
<script>
function toggleTheme(){
  document.body.classList.toggle('light');
  localStorage.setItem('theme', document.body.classList.contains('light')?'light':'dark');
}
addEventListener('DOMContentLoaded',()=>{
  if(localStorage.getItem('theme')==='light')document.body.classList.add('light');
});
</script>
`;

// 🏠 ANA SAYFA (herkese açık)
app.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM posts ORDER BY id DESC LIMIT 5");
    const postsHTML = rows
      .map(
        (p) => `
        <div class="card fade">
          <h3>${p.baslik}</h3>
          <p>${p.icerik}</p>
          <p style="color:#8b949e;font-size:14px">Yazar: ${p.yazar} • ${new Date(p.tarih).toLocaleDateString("tr-TR")}</p>
        </div>`
      )
      .join("");

    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Emirhan'ın Bloğu</title>${theme}</head>
    <body class="fade">
      <header>
        <h3>Emirhan'ın Bloğu</h3>
        <div>
          <a href="/posts" class="btn out">Tüm Yazılar</a>
          <button class="btn out" onclick="toggleTheme()">🌗 Tema</button>
          <a href="/login" class="btn">Giriş</a>
        </div>
      </header>
      <main class="wrap">
        <h2>Son Yazılar</h2>
        ${postsHTML || "<p>Henüz yazı eklenmemiş.</p>"}
      </main>
      <footer>© ${new Date().getFullYear()} Emirhan Mezarcı • Nişantaşı Ü. Bilgisayar Programcılığı</footer>
    </body></html>`);
  } catch (err) {
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

// 🔐 GİRİŞ
app.get("/login", (req, res) => {
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Giriş</title>${theme}</head>
  <body class="fade">
  <header><h3 style="margin-left:28px">Yönetici Girişi</h3></header>
  <main class="wrap">
  <form method="POST" action="/login" class="card">
  <label>Kullanıcı Adı</label><input name="username" required><br>
  <label>Şifre</label><input type="password" name="password" required><br><br>
  <button class="btn">Giriş Yap</button>
  </form>
  </main></body></html>`);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "sa" && password === "Emirhan.") {
    req.session.loggedIn = true;
    return res.redirect("/dashboard");
  }
  return res.send("<p>❌ Hatalı bilgiler</p><a href='/login'>Tekrar Dene</a>");
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));

// 👑 YÖNETİCİ DASHBOARD (sadece giriş yapan)
app.get("/dashboard", requireLogin, (req, res) => {
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Dashboard</title>${theme}</head>
  <body class="fade">
  <header><h3 style="margin-left:28px">Yönetici Paneli</h3></header>
  <main class="wrap">
    <p><a href="/add-post" class="btn">Yeni Yazı Ekle</a> 
       <a href="/posts" class="btn out">Tüm Yazılar</a>
       <a href="/logout" class="btn danger">Çıkış</a></p>
  </main></body></html>`);
});

// 📜 TÜM YAZILAR (yine sadece giriş yapan düzenleyebilir)
app.get("/posts", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM posts ORDER BY id DESC");
    const items = rows
      .map(
        (p) => `
      <div class="card fade">
        <h3>${p.baslik}</h3><p>${p.icerik}</p>
        <small style="color:#8b949e">Yazar: ${p.yazar} | ${new Date(p.tarih).toLocaleDateString("tr-TR")}</small>
        ${
          req.session.loggedIn
            ? `<form method="POST" action="/delete-post/${p.id}">
                 <button class="btn danger" style="margin-top:8px">Sil</button>
               </form>`
            : ""
        }
      </div>`
      )
      .join("");
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Tüm Yazılar</title>${theme}</head>
    <body class="fade">
      <header><h3 style="margin-left:28px">Tüm Yazılar</h3></header>
      <main class="wrap">
        ${req.session.loggedIn ? `<a href="/add-post" class="btn">Yeni Yazı</a>` : ""}
        ${items || "<p>Henüz yazı yok.</p>"}
        <p><a href="/" class="btn out">Ana Sayfa</a></p>
      </main></body></html>`);
  } catch (err) {
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

// ➕ YENİ YAZI FORMU
app.get("/add-post", requireLogin, (req, res) => {
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Yeni Yazı</title>${theme}</head>
  <body class="fade"><main class="wrap">
    <form class="card" method="POST" action="/add-post">
      <label>Başlık</label><input name="baslik" required><br>
      <label>İçerik</label><textarea name="icerik" rows="6" required></textarea><br>
      <input type="hidden" name="yazar" value="Emirhan">
      <button class="btn">Kaydet</button>
    </form>
    <p><a href="/posts" class="btn out">Geri Dön</a></p>
  </main></body></html>`);
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
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

app.post("/delete-post/:id", requireLogin, async (req, res) => {
  try {
    await pool.query("DELETE FROM posts WHERE id=$1", [req.params.id]);
    res.redirect("/posts");
  } catch (err) {
    res.status(500).send("Silme hatası: " + err.message);
  }
});

// SERVER
app.listen(PORT, () => console.log(`🚀 Server ${PORT} portunda çalışıyor`));
