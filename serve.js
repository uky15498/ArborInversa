// 中国美术史·导图 后端 —— 页面/数据读写 + 图片(media/)上传与访问
// 用法: node serve.js [端口]   (默认 8460)
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.argv[2] || "8460", 10);
const DATA = path.join(__dirname, "data.json");
const HTML = path.join(__dirname, "index.html");
const MEDIA = path.join(__dirname, "media");
fs.mkdirSync(MEDIA, { recursive: true });

const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".bmp": "image/bmp", ".avif": "image/avif"
};

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

http.createServer((req, res) => {
  const url = (req.url || "").split("?")[0];

  // 数据
  if (req.method === "GET" && url === "/data") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(fs.readFileSync(DATA, "utf8"));
    return;
  }

  // 保存数据
  if (req.method === "POST" && url === "/save") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const obj = JSON.parse(body);
        if (!obj || !obj.name) throw new Error("缺 name");
        fs.writeFileSync(DATA, JSON.stringify(obj, null, 2), "utf8");
        json(res, 200, { ok: true });
      } catch (e) { json(res, 400, { ok: false, error: String(e.message) }); }
    });
    return;
  }

  // 图片上传 (JSON: {name, data:dataURL})
  if (req.method === "POST" && url === "/upload") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { name, data } = JSON.parse(body);
        const m = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(data || "");
        if (!m) throw new Error("不是有效的图片数据");
        let ext = m[1].toLowerCase();
        if (ext === "jpeg") ext = "jpg";
        if (ext === "svg+xml") ext = "svg";
        let base = path.basename(String(name || "image")).replace(/[^\w\u4e00-\u9fa5.-]/g, "_");
        if (!base) base = "image";
        if (!/\.[a-z0-9]+$/i.test(base)) base += "." + ext;
        let fp = path.join(MEDIA, base);
        let n = 1;
        while (fs.existsSync(fp)) fp = path.join(MEDIA, base.replace(/(\.[a-z0-9]+)$/i, "_" + n++ + "$1"));
        fs.writeFileSync(fp, Buffer.from(m[2], "base64"));
        json(res, 200, { ok: true, name: path.basename(fp) });
      } catch (e) { json(res, 400, { ok: false, error: String(e.message) }); }
    });
    return;
  }

  // 图片访问  /media/<文件名>
  if (req.method === "GET" && url.startsWith("/media/")) {
    const raw = decodeURIComponent(url.slice("/media/".length));
    const safe = path.basename(raw);              // 防目录穿越
    const fp = path.join(MEDIA, safe);
    if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("图片不存在: " + safe);
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(safe).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(fs.readFileSync(fp));
    return;
  }

  // 首页
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(fs.readFileSync(HTML, "utf8"));
}).listen(PORT, "0.0.0.0", () =>
  console.log(`导图已启动: http://127.0.0.1:${PORT}/  (Windows侧用 WSL IP 访问; 图片目录 media/)`));
