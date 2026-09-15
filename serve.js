// ArborInversa（逆生树）备用后端 —— 页面/数据读写 + 图片(media/)上传与访问
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

// 读请求体：必须先把 Buffer 收齐再整体转成字符串。
// 以前写成 body += chunk（隐式 toString），请求体一旦在某个汉字的 3 个字节中间被 TCP 分块切开，
// 那个字就会变成乱码 —— 保存时**悄悄改坏内容**（实测复现过「山水」→「山??」）。
function readBody(req, cb) {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => cb(Buffer.concat(chunks).toString("utf8")));
}

function handle(req, res) {
  const url = (req.url || "").split("?")[0];

  // 数据
  if (req.method === "GET" && url === "/data") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(fs.readFileSync(DATA, "utf8"));
    return;
  }

  // 保存数据
  if (req.method === "POST" && url === "/save") {
    readBody(req, (body) => {
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
    readBody(req, (body) => {
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
}

http.createServer((req, res) => {
  // 兜底：请求处理里任何一处抛异常都不该把整个服务带走。
  // （以前 GET /media/% 这种畸形请求会让 decodeURIComponent 抛错，进程直接退出）
  try {
    handle(req, res);
  } catch (e) {
    try { json(res, 500, { ok: false, error: String((e && e.message) || e) }); } catch (e2) { /* 已经发过响应就算了 */ }
  }
}).listen(PORT, "0.0.0.0", () =>
  console.log(`导图已启动: http://127.0.0.1:${PORT}/  (Windows侧用 WSL IP 访问; 图片目录 media/)`));
