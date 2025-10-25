import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import session from "express-session";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- PostgreSQL ----------
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false }, // Render için gerekli
});

// Tek bağlantı test logu (ikinci kez connect ETME!)
pool
  .connect()
  .then(() => console.log("✅ PostgreSQL bağlantısı başarılı"))
  .catch((err) => console.error("❌ PostgreSQL bağlantı hatası:", err));

// ---------- Middleware ----------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallbackSecret",
    resave: false,
    saveUninitialized: true,
  })
);

// ---------- Helper ----------
function requireLogin(req, res, next) {
  if (req.session?.loggedIn) return next();
  return res.redirect("/login");
}

const theme = `
<style>
  :root{--bg:#0d1117;--panel:#111823;--text:#f0f6fc;--muted:#8b949e;--brand:#58a6ff;--danger:#f85149;}
  body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,Arial,system-ui;transition:.6s}
  .wrap{max-width:900px;margin:0 auto;padding:28px}
  header{position:sticky;top:0;z-index:5;background:rgba(13,17,23,.85);backdrop-filter:saturate(120%) blur(8px);border-bottom:1px solid #222}
  header .i{display:flex;align-items:center;justify-content:space-between;padding:14px 20px}
  h1,h2,h3{margin:0 0 8px}
  a{color:var(--brand);text-decoration:none}
  .btn{background:var(--brand);color:#fff;border:none;border-radius:10px;padding:10px 14px;cursor:pointer}
  .btn.out{background:transparent;border:1px solid #333;color:var(--text)}
  .btn.danger{background:var(--danger)}
  .card{background:var(--panel);border:1px solid #21262d;border-radius:14px;padding:18px;margin:14px 0}
  .muted{color:var(--muted)}
  .grid{display:grid;gap:14px}
  .fade{animation:fade .5s ease both}@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .light{--bg:#fafafa;--panel:#ffffff;--text:#0a0a0a;--muted:#666;--brand:#2563eb;--danger:#dc2626}
  footer{padding:18px;text-align:center;color:var(--muted)}
  input,textarea{width:100%;background:#0f1523;border:1px solid #243042;color:var(--text);
    border-radius:10px;padding:10px;outline:none} .light input,.light textarea{background:#fff;border-color:#e5e7eb}
  .links{display:flex;gap:10px;flex-wrap:wrap}
</style>
<script>
  function toggleTheme(){
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light')?'light':'dark');
  }
  addEventListener('DOMContentLoaded',()=>{
    if(localStorage.getItem('theme')==='light') document.body.classList.add('light');
  });
</script>
`;

// ---------- Routes ----------

// Health (Render check)
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Login
app.get("/login", (req, res) => {
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Giriş Yap</title>${theme}</head>
  <body class="fade">
    <header><div class="i wrap">
      <h3>Emirhan'ın Bloğu</h3>
      <div class="links"><button class="btn out" onclick="toggleTheme()">🌗 Tema</button></div>
    </div></header>
    <main class="wrap">
      <div class="card fade">
        <h2>Yönetici Girişi</h2>
        <p class="muted">Sadece admin yazı ekleyebilir / silebilir.</p>
        <form method="POST" action="/login" class="grid">
          <div><label>Kullanıcı Adı</label><input name="username" required></div>
          <div><label>Şifre</label><input type="password" name="password" required></div>
          <div><button class="btn" type="submit">Giriş Yap</button></div>
        </form>
      </div>
      <footer>© ${new Date().getFullYear()} Emirhan Mezarcı • Nişantaşı Ü. Bilgisayar Programcılığı</footer>
    </main>
  </body></html>`);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === "sa" && password === "Emirhan.") {
    req.session.loggedIn = true;
    return res.redirect("/");
  }
  return res
    .status(401)
    .send(`<p>❌ Hatalı bilgiler.</p><p><a href="/login">Geri dön</a></p>`);
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

// Dashboard
app.get("/", requireLogin, (req, res) => {
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Emirhan'ın Bloğu</title>${theme}</head>
  <body class="fade">
    <header><div class="i wrap">
      <h3>Emirhan'ın Bloğu</h3>
      <div class="links">
        <a class="btn out" href="/posts">📜 Yazılar</a>
        <a class="btn out" href="/add-post">📝 Yazı Ekle</a>
        <button class="btn out" onclick="toggleTheme()">🌗 Tema</button>
        <a class="btn" href="/logout">Çıkış</a>
      </div>
    </div></header>
    <main class="wrap">
      <div class="card fade">
        <h2>Hoş geldin Emirhan 👋</h2>
        <p class="muted">Sol üstteki menüden yazıları yönetebilirsin.</p>
      </div>
      <div class="card">
        <b>İletişim</b>
        <p class="muted">GitHub: <a href="https://github.com/333mirrr" target="_blank">333mirrr</a> •
        📧 emirhanmezarci34@gmail.com • 📱 0533 218 08 17</p>
      </div>
    </main>
    <footer>© ${new Date().getFullYear()} Emirhan Mezarcı</footer>
  </body></html>`);
});

// Yazılar listesi
app.get("/posts", requireLogin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, baslik, icerik, yazar, tarih FROM posts ORDER BY id DESC");
    const items = rows
      .map(
        (p) => `
        <div class="card fade">
          <h3>${escapeHTML(p.baslik)}</h3>
          <p>${escapeHTML(p.icerik)}</p>
          <p class="muted">Yazar: ${escapeHTML(p.yazar)} • Tarih: ${
          p.tarih ? new Date(p.tarih).toLocaleString("tr-TR") : "-"
        }</p>
          <form method="POST" action="/delete-post/${p.id}">
            <button class="btn danger">Sil</button>
          </form>
        </div>`
      )
      .join("");

    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Yazılar</title>${theme}</head>
    <body class="fade">
      <header><div class="i wrap">
        <h3>Tüm Yazılar</h3>
        <div class="links">
          <a class="btn out" href="/">Ana sayfa</a>
          <a class="btn out" href="/add-post">Yeni Yazı</a>
          <button class="btn out" onclick="toggleTheme()">🌗 Tema</button>
          <a class="btn" href="/logout">Çıkış</a>
        </div>
      </div></header>
      <main class="wrap">${items || '<div class="card">Henüz yazı yok.</div>'}</main>
      <footer>© ${new Date().getFullYear()} Emirhan Mezarcı</footer>
    </body></html>`);
  } catch (err) {
    console.error("Listeleme hatası:", err);
    res.status(500).send("Sunucu hatası");
  }
});

// Yeni yazı formu
app.get("/add-post", requireLogin, (_req, res) => {
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Yeni Yazı</title>${theme}</head>
  <body class="fade">
    <header><div class="i wrap">
      <h3>Yeni Yazı</h3>
      <div class="links">
        <a class="btn out" href="/posts">Yazılara Dön</a>
        <button class="btn out" onclick="toggleTheme()">🌗 Tema</button>
        <a class="btn" href="/logout">Çıkış</a>
      </div>
    </div></header>
    <main class="wrap">
      <form class="card grid" method="POST" action="/add-post">
        <div><label>Başlık</label><input name="baslik" required></div>
        <div><label>İçerik</label><textarea name="icerik" rows="6" required></textarea></div>
        <input type="hidden" name="yazar" value="Emirhan">
        <div><button class="btn" type="submit">Kaydet</button></div>
      </form>
    </main>
    <footer>© ${new Date().getFullYear()} Emirhan Mezarcı</footer>
  </body></html>`);
});

// Yazı ekleme
app.post("/add-post", requireLogin, async (req, res) => {
  const { baslik, icerik, yazar } = req.body || {};
  try {
    await pool.query(
      "INSERT INTO posts (baslik, icerik, yazar, tarih) VALUES ($1,$2,$3,NOW())",
      [baslik, icerik, yazar]
    );
    res.redirect("/posts");
  } catch (err) {
    console.error("Ekleme hatası:", err);
    res.status(500).send("Sunucu hatası");
  }
});

// Yazı silme
app.post("/delete-post/:id", requireLogin, async (req, res) => {
  try {
    await pool.query("DELETE FROM posts WHERE id=$1", [req.params.id]);
    res.redirect("/posts");
  } catch (err) {
    console.error("Silme hatası:", err);
    res.status(500).send("Sunucu hatası");
  }
});

// 404
app.use((_req, res) => res.status(404).send("Bulunamadı"));

// ---------- Start ----------
app.listen(PORT, () => console.log(`🚀 Server ${PORT} portunda çalışıyor`));

// Basit XSS kaçışı
function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
