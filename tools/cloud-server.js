#!/usr/bin/env node
// 逆生树 · 云端（零依赖单文件 Node 服务）
// ============================================================================
// 干什么：把树存进「账号」里，任何设备打开网页就能读写同一棵树。
//
//   账号 ＝ 用户名 ＋ 口令 ＋ **分区**
//   分区 ＝ 广韵十六摄：通 江 止 遇 蟹 臻 山 效 果 假 宕 梗 曾 流 深 咸
//
// ★ 为什么要分区：用户名是自己起的，**撞名是常态**。把 16 摄当 16 个区，
//   同名的第 1 个人进「通」、第 2 个进「江」……于是「小明」最多能有 16 个，
//   互不干扰；换设备登录时按「用户名 ＋ 口令」认人（口令对得上哪个区就是哪个区）。
//   分区平时不显示，只在「用户数据」里、或用户名长停时浮出来。
//
// 落盘（默认 ./cloud-data，可用 --root 改）：
//   accounts/<摄>/<用户名>.json   账号：盐 ＋ 口令哈希（**不存明文口令**）
//   trees/<摄>/<用户名>.json      就是那棵树，和 data.json 同构，可以直接拷走
//   media/<摄>/<用户名>/<值>.<后缀>   插图（第二阶段）
//   .secret                       签令牌用的密钥，首次启动自动生成
//
// 跑起来（★ 推荐带 --site：网页和接口同源，就不用域名、不用证书，详见下）：
//   node cloud-server.js --port 8488 --root /var/lib/arborinversa-cloud --site ./site
//     —— site/ 里放便携版 index.html 和 media/，手机打开 http://<这台机的IP>:8488/ 就是应用
//   node cloud-server.js --port 8488 --root /var/lib/arborinversa-cloud
//   直接上 HTTPS（不用 nginx 也行）：
//     node cloud-server.js --port 8443 --tls-key key.pem --tls-cert fullchain.pem
//   挂在 nginx/caddy 后面就让它们终止 TLS，这里只监听 127.0.0.1：
//     node cloud-server.js --host 127.0.0.1 --port 8488
//
// 接口（全部 JSON；写操作要 Authorization: Bearer <令牌>）：
//   GET  /api/health                     活着吗（含版本）
//   GET  /api/parts?name=小明             这个名字在哪些区已经被占了
//   POST /api/register  {name,pass,part?} 建号；不给 part 就自动挑一个空区
//   POST /api/login     {name,pass,part?} 登入；同名跨多区且没给 part → 409 ＋ 候选清单
//   GET  /api/me                         我是谁、在哪个区、树多大、最后改于
//   GET  /api/tree                       取树 {tree, 版本, 改于}
//   PUT  /api/tree      {tree, 版本}      存树；版本对不上 → 409（客户端问用户要不要覆盖）
//   POST /api/pass      {pass,新pass}     改口令
//
// ★ 口令用 scrypt 加盐哈希，令牌是 HMAC 签名的（服务端不存会话，重启不用重登）。
// ★ 客户端跨域来（GitHub Pages 那份便携版）靠 CORS 头，见 CORS 一节。
//
// ★★ 要不要域名？——**不用**，只要网页也从这台服务器发（--site）：
//   · 双击打开的便携版（file://）能直接调 http 接口 —— 实测通
//   · 服务器自己发的网页（同源 http）—— 实测通
//   · 只有「https 页面调 http 公网接口」会被浏览器当混合内容拦掉（实测：内网地址放行、公网地址拦）
//     —— 所以 GitHub Pages 上那份要想连过来，才需要 https，也就才需要域名
//   国内服务器上，80/443 跑未备案的域名会被云厂商拦；**非标端口 ＋ IP** 一般不涉及备案
//   （记得在安全组/防火墙放行端口）。纯 http 口令与令牌是明文过网的，介意就上自签证书（--tls-key/--tls-cert）。
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---- 广韵十六摄：分区就是这 16 个字，一个都不能改（改了等于换了区）----
const PARTS = ['通','江','止','遇','蟹','臻','山','效','果','假','宕','梗','曾','流','深','咸'];

// ---- 命令行 ----
function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const PORT = parseInt(arg('port', '8488'), 10);
const HOST = arg('host', '0.0.0.0');
const ROOT = path.resolve(arg('root', path.join(__dirname, '..', 'cloud-data')));
const TLS_KEY = arg('tls-key', '');
const TLS_CERT = arg('tls-cert', '');
const SITE = arg('site', '');                          // 顺带把网页也发出去（见下）
const MAX_BODY = parseInt(arg('max-body', String(16 * 1024 * 1024)), 10);   // 16 MB

const DIR_ACC = path.join(ROOT, 'accounts');
const DIR_TREE = path.join(ROOT, 'trees');
const DIR_MEDIA = path.join(ROOT, 'media');
const SECRET_FILE = path.join(ROOT, '.secret');

for (const d of [ROOT, DIR_ACC, DIR_TREE, DIR_MEDIA]) fs.mkdirSync(d, { recursive: true });

// ---- 令牌密钥：首次启动生成，之后一直用这一份（重启不掉线）----
let SECRET;
try {
  SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
} catch (e) { SECRET = ''; }
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, SECRET + '\n', { mode: 0o600 });
  console.log('· 已生成令牌密钥 ' + SECRET_FILE + '（备份时别忘了它，换了它所有设备都要重登）');
}

// ---- 小工具 ----
const nowISO = () => new Date().toISOString();
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function hashPass(pass, salt) {                       // scrypt：慢，抗爆破；盐每个账号一份
  return crypto.scryptSync(String(pass), Buffer.from(salt, 'hex'), 64).toString('hex');
}
function safeEqual(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const mac = b64u(crypto.createHmac('sha256', SECRET).update(body).digest());
  return body + '.' + mac;
}
function verify(token) {
  const s = String(token || ''), i = s.indexOf('.');
  if (i <= 0) return null;
  const body = s.slice(0, i), mac = s.slice(i + 1);
  const want = b64u(crypto.createHmac('sha256', SECRET).update(body).digest());
  if (!safeEqual(mac, want)) return null;
  let p; try { p = JSON.parse(unb64u(body).toString('utf8')); } catch (e) { return null; }
  if (!p || !p.exp || p.exp < Date.now()) return null;
  return p;
}

// ★ 用户名会变成文件名，必须挡住路径穿越和奇怪字符
function nameOK(name) {
  const s = String(name == null ? '' : name).normalize('NFC').trim();
  if (!s || s.length > 32) return null;
  if (s === '.' || s === '..' || s[0] === '.') return null;
  if (/[\/\\:*?"<>|\u0000-\u001f]/.test(s)) return null;   // 路径分隔符与控制字符一律不要
  return s;
}
function partOK(part) { return PARTS.indexOf(String(part || '')) >= 0 ? String(part) : null; }

const accPath = (part, name) => path.join(DIR_ACC, part, name + '.json');
const treePath = (part, name) => path.join(DIR_TREE, part, name + '.json');

function readJSON(file, dflt) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return dflt; }
}
function writeJSON(file, obj) {                        // 先写临时文件再改名：断电也不会写坏半截
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, file);
}
const treeVersion = tree => crypto.createHash('sha256').update(JSON.stringify(tree)).digest('hex').slice(0, 16);

// ---- 登录失败次数：很轻的一道闸，挡暴力猜口令 ----
const fails = new Map();                                // key → {n, 直到}
function failKey(name, ip) { return ip + '|' + name; }
function tooMany(name, ip) {
  const f = fails.get(failKey(name, ip));
  return !!(f && f.n >= 12 && f.until > Date.now());
}
function noteFail(name, ip) {
  const k = failKey(name, ip), f = fails.get(k) || { n: 0, until: 0 };
  f.n++; f.until = Date.now() + 10 * 60 * 1000;
  fails.set(k, f);
}
function noteOK(name, ip) { fails.delete(failKey(name, ip)); }

// ---- HTTP 小工具 ----
function send(res, code, obj, extra) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  }, CORS, extra || {}));
  res.end(body);
}
// ★ 跨域：便携版可能开在 file:// 或 GitHub Pages 上，是「另一个源」。
//   我们用 Bearer 令牌而不是 Cookie，所以放开来源是安全的（谁也不知道别人的令牌）。
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
};
function readBody(req) {                               // ★ 先收 Buffer 再整体转 UTF-8（分块 += 会把汉字切坏）
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0, over = false;
    req.on('data', c => {
      if (over) return;                                // 已经超了：继续把剩下的读掉（不能掐连接，
      n += c.length;                                   //   掐了客户端就收不到 413 了）
      if (n > MAX_BODY) {
        over = true; chunks.length = 0;
        reject(Object.assign(new Error('内容太大'), { code: 'TOOBIG' }));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => { if (!over) resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', e => { if (!over) reject(e); });
  });
}
function auth(req) {
  const h = String(req.headers.authorization || '');
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? verify(m[1].trim()) : null;
}
const clientIP = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  || (req.socket && req.socket.remoteAddress) || '?';

// ---- 业务 ----
function takenParts(name) {                            // 这个名字已经被哪些区占了
  return PARTS.filter(p => fs.existsSync(accPath(p, name)));
}
function freeParts(name) { return PARTS.filter(p => !fs.existsSync(accPath(p, name))); }

function doRegister(body, ip) {
  const name = nameOK(body.name);
  if (!name) return { code: 400, out: { ok: false, error: '用户名不合适：1~32 个字，别用 / \\ : * ? " < > | 和开头的点' } };
  const pass = String(body.pass == null ? '' : body.pass);
  if (pass.length < 6) return { code: 400, out: { ok: false, error: '口令至少 6 位' } };
  let part = partOK(body.part);
  if (body.part && !part) return { code: 400, out: { ok: false, error: '分区只能是这 16 个之一：' + PARTS.join(' ') } };
  if (!part) {                                         // 默认：自动挑一个还空着的区
    const free = freeParts(name);
    if (!free.length) return { code: 409, out: { ok: false, error: '这个名字的 16 个区都占满了，换一个用户名吧' } };
    part = free[0];
  } else if (fs.existsSync(accPath(part, name))) {
    return { code: 409, out: { ok: false, error: '「' + part + '」区已经有叫「' + name + '」的了 —— 换个用户名，或者换一个区', 占用: takenParts(name) } };
  }
  const salt = crypto.randomBytes(16).toString('hex');
  writeJSON(accPath(part, name), {
    name: name, part: part, salt: salt, hash: hashPass(pass, salt),
    created: nowISO(), updated: nowISO(),
  });
  writeJSON(treePath(part, name), { name: name, leaves: [], children: [] });   // 先给一棵空树
  const token = sign({ u: name, p: part, exp: Date.now() + 90 * 24 * 3600 * 1000 });
  return { code: 200, out: { ok: true, name: name, part: part, token: token, 新建: true } };
}

function doLogin(body, ip) {
  const name = nameOK(body.name);
  if (!name) return { code: 400, out: { ok: false, error: '用户名不合适' } };
  if (tooMany(name, ip)) return { code: 429, out: { ok: false, error: '失败次数太多，过十分钟再试' } };
  const pass = String(body.pass == null ? '' : body.pass);
  let part = partOK(body.part);
  const has = takenParts(name);
  if (!has.length) return { code: 404, out: { ok: false, error: '没有叫「' + name + '」的账号 —— 要新建吗？' } };
  if (!part && has.length > 1) {                        // 同名跨多区：让用户点一下选哪个
    return { code: 409, out: { ok: false, error: '有 ' + has.length + ' 个区都叫「' + name + '」，选一个进来', 候选: has } };
  }
  const want = part || has[0];
  const acc = readJSON(accPath(want, name), null);
  if (!acc) return { code: 404, out: { ok: false, error: '「' + want + '」区没有叫「' + name + '」的账号', 候选: has } };
  if (!safeEqual(hashPass(pass, acc.salt), acc.hash)) {
    noteFail(name, ip);
    return { code: 401, out: { ok: false, error: '口令不对' } };
  }
  noteOK(name, ip);
  const token = sign({ u: name, p: want, exp: Date.now() + 90 * 24 * 3600 * 1000 });
  return { code: 200, out: { ok: true, name: name, part: want, token: token } };
}

function doSaveTree(body, who) {
  const file = treePath(who.p, who.u);
  if (!fs.existsSync(file)) return { code: 404, out: { ok: false, error: '账号没了？' } };
  const tree = body.tree;
  if (!tree || typeof tree !== 'object' || Array.isArray(tree)) return { code: 400, out: { ok: false, error: 'tree 得是一棵树' } };
  if (!nameOK(tree.name) && typeof tree.name !== 'string') return { code: 400, out: { ok: false, error: '树没有名字' } };
  const cur = readJSON(file, null);
  const curVer = cur ? treeVersion(cur) : null;
  if (body.版本 && curVer && body.版本 !== curVer) {     // 别的设备改过 → 别默默覆盖
    return { code: 409, out: { ok: false, error: '云端这棵树在别处改过了', 远端版本: curVer, 远端改于: (readJSON(accPath(who.p, who.u), {}) || {}).updated } };
  }
  writeJSON(file, tree);
  const acc = readJSON(accPath(who.p, who.u), {});
  acc.updated = nowISO(); writeJSON(accPath(who.p, who.u), acc);
  return { code: 200, out: { ok: true, 版本: treeVersion(tree), 改于: acc.updated } };
}

// ---- 顺带把网页发出去（--site <目录>）------------------------------------
// ★ 这一步是为了**不用域名**：网页和接口都从这台机器、这个端口出去，就是「同源」，
//   浏览器不会拦 https 页面向 http 接口要数据（混合内容），也不需要证书。
//   目录里放便携版 HTML（index.html）和 media/ 就行。
const MIME = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon', avif: 'image/avif',
};
function serveSite(req, res, urlPath) {
  const rootDir = path.resolve(SITE);
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.resolve(path.join(rootDir, rel));
  if (file !== rootDir && !file.startsWith(rootDir + path.sep)) {   // ★ 挡住 ../../ 穿越
    return send(res, 403, { ok: false, error: '不许往外走' });
  }
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { ok: false, error: '没有这个文件：' + rel });
    const ext = path.extname(file).slice(1).toLowerCase();
    res.writeHead(200, Object.assign({
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': buf.length,
      'Cache-Control': ext === 'html' ? 'no-cache' : 'public, max-age=300',
    }, CORS));
    res.end(buf);
  });
}

// ---- 路由 ----
async function route(req, res) {
  const u = new URL(req.url || '/', 'http://x');
  const p = u.pathname.replace(/\/+$/, '') || '/';
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const ip = clientIP(req);
  // 带 Content-Length 的先看一眼，省得白读一遍（curl 之类都会带）
  const 声明长度 = Number(req.headers['content-length'] || 0);
  if (声明长度 > MAX_BODY) return send(res, 413, { ok: false, error: '内容太大（上限 ' + Math.round(MAX_BODY / 1048576) + ' MB）' });

  if (req.method === 'GET' && (p === '/' || p === '/api/health')) {
    if (p === '/' && SITE) return serveSite(req, res, '/');     // 有 --site 就先发网页
    return send(res, 200, { ok: true, 服务: 'arborinversa-cloud', 版本: 1, 分区: PARTS, 账号数: countAccounts() });
  }
  if (SITE && req.method === 'GET' && p.indexOf('/api/') !== 0) {   // 静态网页/图片
    return serveSite(req, res, u.pathname);
  }
  if (req.method === 'GET' && p === '/api/parts') {
    const name = nameOK(u.searchParams.get('name') || '');
    if (!name) return send(res, 400, { ok: false, error: '给个名字' });
    const taken = takenParts(name);
    return send(res, 200, { ok: true, 分区: PARTS, 占用: taken, 空着: PARTS.filter(x => taken.indexOf(x) < 0) });
  }
  if (req.method === 'POST' && p === '/api/register') {
    const b = JSON.parse((await readBody(req)) || '{}');
    const r = doRegister(b, ip); return send(res, r.code, r.out);
  }
  if (req.method === 'POST' && p === '/api/login') {
    const b = JSON.parse((await readBody(req)) || '{}');
    const r = doLogin(b, ip); return send(res, r.code, r.out);
  }
  if (p === '/api/me' || p === '/api/tree' || p === '/api/pass') {
    const who = auth(req);
    if (!who) return send(res, 401, { ok: false, error: '令牌无效或过期 —— 重新登录一下' });
    const acc = readJSON(accPath(who.p, who.u), null);
    if (!acc) return send(res, 404, { ok: false, error: '账号不存在（被删了？）' });
    if (p === '/api/me' && req.method === 'GET') {
      const tree = readJSON(treePath(who.p, who.u), null);
      const bytes = fs.existsSync(treePath(who.p, who.u)) ? fs.statSync(treePath(who.p, who.u)).size : 0;
      return send(res, 200, {
        ok: true, name: who.u, part: who.p, 建号: acc.created, 改于: acc.updated,
        版本: tree ? treeVersion(tree) : null, 字节: bytes,
      });
    }
    if (p === '/api/tree' && req.method === 'GET') {
      const tree = readJSON(treePath(who.p, who.u), null);
      if (!tree) return send(res, 404, { ok: false, error: '这棵树的文件不见了' });
      return send(res, 200, { ok: true, tree: tree, 版本: treeVersion(tree), 改于: acc.updated });
    }
    if (p === '/api/tree' && req.method === 'PUT') {
      const b = JSON.parse((await readBody(req)) || '{}');
      const r = doSaveTree(b, who); return send(res, r.code, r.out);
    }
    if (p === '/api/pass' && req.method === 'POST') {
      const b = JSON.parse((await readBody(req)) || '{}');
      if (!safeEqual(hashPass(String(b.pass == null ? '' : b.pass), acc.salt), acc.hash)) {
        noteFail(who.u, ip); return send(res, 401, { ok: false, error: '原口令不对' });
      }
      const np = String(b['新pass'] == null ? '' : b['新pass']);
      if (np.length < 6) return send(res, 400, { ok: false, error: '新口令至少 6 位' });
      acc.salt = crypto.randomBytes(16).toString('hex');
      acc.hash = hashPass(np, acc.salt);
      acc.updated = nowISO(); writeJSON(accPath(who.p, who.u), acc);
      return send(res, 200, { ok: true });               // 旧令牌仍有效直到过期
    }
    return send(res, 405, { ok: false, error: '这个路径不支持 ' + req.method });
  }
  return send(res, 404, { ok: false, error: '没有这个接口：' + p });
}
function countAccounts() {
  let n = 0;
  for (const part of PARTS) {
    try { n += fs.readdirSync(path.join(DIR_ACC, part)).filter(f => f.endsWith('.json')).length; } catch (e) {}
  }
  return n;
}

// ---- 起服务 ----
const handler = (req, res) => {
  route(req, res).catch(e => {
    const code = (e && e.code === 'TOOBIG') ? 413 : 500;
    try { send(res, code, { ok: false, error: (e && e.message) || String(e) }); } catch (e2) {}
    if (!(e && e.code === 'TOOBIG')) console.error('× ' + req.method + ' ' + req.url + ' → ' + (e && e.stack || e));
  });
};
const server = (TLS_KEY && TLS_CERT)
  ? https.createServer({ key: fs.readFileSync(TLS_KEY), cert: fs.readFileSync(TLS_CERT) }, handler)
  : http.createServer(handler);

server.on('error', e => {                              // 端口被占、没权限绑低端口…… 说人话
  if (e && e.code === 'EADDRINUSE') console.error('× 端口 ' + PORT + ' 已被占用 —— 换一个（--port 8489），或先停掉占它的进程');
  else if (e && e.code === 'EACCES') console.error('× 没权限绑 ' + PORT + ' 端口 —— 1024 以下的端口要 root，或者交给 nginx 反代');
  else console.error('× 起不来：' + (e && e.message || e));
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const scheme = (TLS_KEY && TLS_CERT) ? 'https' : 'http';
  console.log('逆生树 · 云端已启动：  ' + scheme + '://' + (HOST === '0.0.0.0' ? '本机地址' : HOST) + ':' + PORT + '/api/health');
  console.log('· 数据目录：' + ROOT);
  console.log('· 现有账号：' + countAccounts() + ' 个（分区：' + PARTS.join(' ') + '）');
  if (SITE) console.log('· 网页目录：' + path.resolve(SITE) + '（打开 ' + scheme + '://' + (HOST === '0.0.0.0' ? '<本机IP>' : HOST) + ':' + PORT + '/ 就是应用）');
  else console.log('· 没配 --site：只提供接口。想让手机/别的设备直接打开应用就加上 --site <便携版所在目录>');
  if (HOST === '0.0.0.0' && !(TLS_KEY && TLS_CERT)) console.log('⚠ 现在跑的是明文 HTTP —— 对外一定要挂 HTTPS（--tls-key/--tls-cert，或用 nginx 反代）');
});
