import express from "express";
import session from "express-session";
import { connectDB } from "./db/config.js";
import sql from "mssql";

const app = express();
const port = 5000;

// 🔹 Statik dosyalar
app.use(express.static("pages"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔹 Oturum (session)
app.use(
  session({
    secret: "blog_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

let pool;
(async () => {
  pool = await connectDB();
})();

// 🌈 Stil + Tema geçişi + Animasyonlar
const baseStyle = `
  <style>
    :root {
      --bg-dark: #0d0d0d;
      --card-bg-dark: #1a1a1a;
      --text-light: #f5f5f5;
      --text-gray: #bbb;
      --accent: #00bfff;
      --danger: #ff4d4d;
      --bg-light: #fafafa;
      --card-bg-light: #ffffff;
      --text-dark: #222;
      --text-muted: #555;
    }

    * { box-sizing: border-box; transition: all 0.3s ease; }

    body {
      background-color: var(--bg-dark);
      color: var(--text-light);
      font-family: 'Poppins','Segoe UI',sans-serif;
      margin: 0; padding-top: 70px;
      min-height: 100vh;
      display: flex; flex-direction: column;
      opacity: 0; animation: fadeIn 1s ease forwards;
    }
    body.light { background-color: var(--bg-light); color: var(--text-dark); }

    nav {
      position: fixed; top: 0; left: 0; width: 100%; height: 70px;
      background-color: var(--card-bg-dark);
      display: flex; justify-content: space-between; align-items: center;
      padding: 0 30px; border-bottom: 1px solid #222; z-index: 1000;
    }
    body.light nav { background-color: var(--card-bg-light); border-bottom: 1px solid #ddd; }
    nav .logo { font-weight: 700; color: var(--accent); font-size: 1.3rem; }
    nav .links a { color: var(--text-gray); margin-left: 20px; text-decoration: none; }
    nav .links a:hover { color: var(--accent); transform: scale(1.1); }
    .theme-toggle { cursor: pointer; font-size: 1.4rem; margin-left: 20px; }

    main { width:95%; max-width:950px; margin:20px auto; flex:1; text-align:center; }

    @keyframes fadeIn { from{opacity:0} to{opacity:1} }

    .hero {
      position:relative; height:60vh; background:url('/banner.jpg') center/cover no-repeat;
      display:flex; align-items:center; justify-content:center; color:white;
    }
    .hero::after { content:""; position:absolute; inset:0; background:rgba(0,0,0,0.6); }
    .hero-content { position:relative; z-index:2; }
    .hero h1 { color:var(--accent); font-size:2.6rem; }

    .about {
      background-color:var(--card-bg-dark); border-radius:12px;
      padding:30px; margin:30px auto;
    }
    .about img { width:120px; height:120px; border-radius:50%; border:3px solid var(--accent); }

    .card {
      background-color:var(--card-bg-dark); border-radius:12px; padding:25px; margin-bottom:25px;
      text-align:left;
    }
    body.light .card { background-color:var(--card-bg-light); }

    .card .title { font-size:1.5rem; color:var(--accent); margin-bottom:10px; }
    .card .content { line-height:1.6; margin-bottom:15px; }

    footer {
      background-color:var(--card-bg-dark);
      color:var(--text-gray); text-align:center;
      padding:15px; border-top:1px solid #333;
    }
    .contact { display:flex; flex-wrap:wrap; justify-content:center; gap:12px; margin-top:6px; font-size:0.9rem; }
    footer a { color:var(--accent); text-decoration:none; }

    .login-container {
      max-width:400px; margin:150px auto; background:rgba(255,255,255,0.05);
      padding:40px; border-radius:12px; text-align:center; backdrop-filter:blur(10px);
    }
    body.light .login-container { background:rgba(255,255,255,0.9); color:#111; }
    input { width:100%; padding:12px; margin-bottom:15px; border:none; border-radius:6px; }
    button { background:var(--accent); color:white; border:none; padding:12px; width:100%; border-radius:6px; cursor:pointer; font-weight:600; }
    button:hover { background:#1e90ff; }
  </style>

  <script>
    document.addEventListener("DOMContentLoaded", () => {
      const theme = localStorage.getItem("theme") || "dark";
      if (theme === "light") document.body.classList.add("light");

      const toggle = document.querySelector(".theme-toggle");
      if (toggle) {
        toggle.textContent = document.body.classList.contains("light") ? "🌙" : "☀️";
        toggle.addEventListener("click", () => {
          document.body.classList.toggle("light");
          const mode = document.body.classList.contains("light") ? "light" : "dark";
          localStorage.setItem("theme", mode);
          toggle.textContent = mode === "light" ? "🌙" : "☀️";
        });
      }
    });
  </script>
`;

function footerSection() {
  return `
    <footer>
      © 2025 Emirhan's Blog
      <div class="contact">
        <span>📞 0533 218 08 17</span>
        <span>📧 <a href="mailto:emirhanmezarci34@gmail.com">emirhanmezarci34@gmail.com</a></span>
        <span>💻 <a href="https://github.com/333mirrr" target="_blank">github.com/333mirrr</a></span>
        <span>🎓 Nişantaşı Üniversitesi — Bilgisayar Programcılığı</span>
      </div>
    </footer>
  `;
}

// 🏠 Ana Sayfa
app.get("/", (req, res) => {
  res.send(`
  <html><head>${baseStyle}<title>Emirhan'ın Blogu</title></head>
  <body>
    <nav><div class="logo">Emirhan's Blog</div>
    <div class="links">
      <a href="/">Ana Sayfa</a>
      <a href="/posts">Yazılar</a>
      ${req.session.loggedIn ? '<a href="/add-post">Yeni Yazı</a><a href="/logout">Çıkış</a>' : '<a href="/login">Giriş</a>'}
      <span class="theme-toggle">☀️</span>
    </div></nav>
    <main>
      <section class="hero"><div class="hero-content">
        <h1>🖋️ Düşüncelerini Kodla.</h1>
        <p>Yazılım, teknoloji ve kişisel gelişim üzerine paylaşımlar.</p>
        <a href="/posts" style="background:var(--accent);color:white;padding:12px 25px;border-radius:6px;text-decoration:none;">Yazılara Göz At</a>
      </div></section>
      <section class="about"><img src="/profile.jpg"><h2>Merhaba, Ben Emirhan Mezarcı 👋</h2>
      <p>Yazılım geliştiricisiyim. Bu blogda teknoloji, kodlama ve web geliştirme üzerine yazılar paylaşıyorum.</p></section>
    </main>${footerSection()}
  </body></html>
  `);
});

// 🔐 Login
app.get("/login", (req, res) => {
  if (req.session.loggedIn) return res.redirect("/add-post");
  res.send(`
  <html><head>${baseStyle}<title>Giriş Yap</title></head><body>
  <div class="login-container">
    <h2>🔐 Yönetici Girişi</h2>
    <form method="POST" action="/login">
      <input type="text" name="username" placeholder="Kullanıcı Adı" required>
      <input type="password" name="password" placeholder="Şifre" required>
      <button type="submit">Giriş Yap</button>
    </form>
  </div></body></html>
  `);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "sa" && password === "Emirhan.") {
    req.session.loggedIn = true;
    res.redirect("/add-post");
  } else {
    res.send("<h2 style='text-align:center;margin-top:100px;color:red;'>❌ Hatalı kullanıcı adı veya şifre!</h2>");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// ✍️ Yeni Yazı (korumalı)
app.get("/add-post", (req, res) => {
  if (!req.session.loggedIn)
    return res.send("<h2 style='text-align:center;margin-top:100px;color:red;'>🚫 Yetkiniz yok. <a href='/login'>Giriş yap</a>.</h2>");
  res.send(`
  <html><head>${baseStyle}<title>Yeni Yazı</title></head><body>
  <nav><div class="logo">Emirhan's Blog</div>
  <div class="links"><a href="/">Ana Sayfa</a><a href="/posts">Yazılar</a><a href="/logout">Çıkış</a><span class="theme-toggle">☀️</span></div></nav>
  <main style="margin-top:100px;">
  <h1>📝 Yeni Blog Yazısı Ekle</h1>
  <form action="/add-post" method="post" style="max-width:600px;margin:auto;">
    <input name="Title" placeholder="Başlık" required>
    <textarea name="Content" placeholder="İçerik" rows="6" required></textarea>
    <input name="Author" placeholder="Yazar" required>
    <button type="submit">✨ Kaydet</button>
  </form></main>${footerSection()}</body></html>
  `);
});

app.post("/add-post", async (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send("Yetkiniz yok.");
  try {
    const { Title, Content, Author } = req.body;
    await pool.request()
      .input("Title", sql.NVarChar, Title)
      .input("Content", sql.NVarChar, Content)
      .input("Author", sql.NVarChar, Author)
      .query("INSERT INTO Posts (Title,Content,Author) VALUES (@Title,@Content,@Author)");
    res.redirect("/posts");
  } catch (err) {
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

// 📜 Yazı Listesi
app.get("/posts", async (req, res) => {
  try {
    const result = await pool.request().query("SELECT * FROM Posts ORDER BY CreatedAt DESC");
    let html = `<html><head>${baseStyle}<title>Yazılar</title></head><body>
    <nav><div class="logo">Emirhan's Blog</div>
    <div class="links"><a href="/">Ana Sayfa</a>${req.session.loggedIn ? '<a href="/add-post">Yeni Yazı</a><a href="/logout">Çıkış</a>' : '<a href="/login">Giriş</a>'}<span class="theme-toggle">☀️</span></div></nav>
    <main><h2 style="color:var(--accent);">📚 Tüm Yazılar</h2>`;
    if (result.recordset.length === 0) html += "<p>Henüz yazı yok.</p>";
    else result.recordset.forEach(p => {
      const c = new Date(p.CreatedAt).toLocaleString("tr-TR");
      html += `<div class="card"><div class="title">${p.Title}</div>
      <div class="content">${p.Content.substring(0,200)}...</div>
      <div class="meta">✍️ ${p.Author} | 🕒 ${c}</div>
      ${req.session.loggedIn ? `<a href="/delete/${p.Id}" style="color:red;text-decoration:none;">🗑️ Sil</a>` : ""}
      </div>`;
    });
    html += `</main>${footerSection()}</body></html>`;
    res.send(html);
  } catch (err) {
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

// 🗑️ Yazı Sil (korumalı)
app.get("/delete/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send("Yetkiniz yok.");
  try {
    const id = parseInt(req.params.id);
    await pool.request().input("Id", sql.Int, id).query("DELETE FROM Posts WHERE Id=@Id");
    res.redirect("/posts");
  } catch (err) {
    res.status(500).send("Sunucu hatası: " + err.message);
  }
});

app.listen(port, () => console.log(`✅ Server http://localhost:${port} üzerinde çalışıyor`));
