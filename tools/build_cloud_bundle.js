#!/usr/bin/env node
// 打「云端成品包」：把服务端、网页、安装脚本、说明打成一份可以直接丢给服务器的东西。
//
//   node tools/build_cloud_bundle.js [树源文件] [输出目录]
//     树源文件默认 示例树.txt —— 它是网页里那份「离线默认内容」；
//     用户登录云端后，读到的是自己账号里的树，与这个无关。
//     想让自己那棵树当默认，就传 data.json 或某个 .txt。
//
// 产物：
//   dist-cloud/arborinversa-cloud/
//     cloud-server.js              服务端（零依赖）
//     site/index.html              便携版网页（＝应用本体）
//     site/media/*                 插图（示例树引用的那几张）
//     arborinversa-cloud.service   systemd 单元
//     安装.sh                      一键安装（幂等，可反复跑）
//     说明.md                      给服务器维护者看的（＝ tools/cloud-部署.md）
//   dist-cloud/arborinversa-cloud.tar.gz   上面整个文件夹的压缩包
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const REPO = path.join(__dirname, '..');
const SRC = process.argv[2] || '示例树.txt';
const OUTDIR = path.resolve(process.argv[3] || path.join(REPO, 'dist-cloud'));
const NAME = 'arborinversa-cloud';
const PKG = path.join(OUTDIR, NAME);

fs.rmSync(PKG, { recursive: true, force: true });
fs.mkdirSync(path.join(PKG, 'site'), { recursive: true });

// ---- 1) 网页：用现成的构建脚本生成便携版 ----
console.log('· 生成网页（' + SRC + ' → site/index.html）');
cp.execFileSync(process.execPath, [path.join(__dirname, 'build_web.js'), SRC, path.join(PKG, 'site', 'index.html')],
  { cwd: REPO, stdio: ['ignore', 'ignore', 'inherit'] });

// ---- 2) 插图：只拷这棵树真正引用的那几张 ----
const mediaSrc = path.join(REPO, 'media');
const html = fs.readFileSync(path.join(PKG, 'site', 'index.html'), 'utf8');
// ★ 别用宽松的 <script id="tree-data"…> 去配：portable-store.js 的**注释里**就写着这么一句，
//   会先配上它、把一大段源码当内容。按构建脚本真正写出来的形状配。
const m = /<script id="tree-data" type="text\/plain">\n([\s\S]*?)\n<\/script>/.exec(html);
const treeText = (m ? m[1] : '').replace(/<\\\//g, '</');
const refs = new Set();
for (const x of treeText.matchAll(/!\[\[([^\]|]+)/g)) refs.add(x[1].trim());
const EXTS = ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'];
let 拷了 = 0, 缺的 = [];
const files = fs.existsSync(mediaSrc) ? fs.readdirSync(mediaSrc) : [];
for (const ref of refs) {
  const 找到 = /\.[a-z0-9]+$/i.test(ref)
    ? (fs.existsSync(path.join(mediaSrc, ref)) ? ref : null)
    : (files.find(f => path.parse(f).name === ref) || null);
  if (找到) {
    fs.mkdirSync(path.join(PKG, 'site', 'media'), { recursive: true });   // 别指望它自己存在
    fs.copyFileSync(path.join(mediaSrc, 找到), path.join(PKG, 'site', 'media', 找到)); 拷了++;
  }
  else 缺的.push(ref);
}
console.log('· 插图 ' + 拷了 + ' 张' + (缺的.length ? '（这些没有，网页上会画占位框：' + 缺的.join('、') + '）' : ''));

// ---- 3) 服务端 ----
fs.copyFileSync(path.join(__dirname, 'cloud-server.js'), path.join(PKG, 'cloud-server.js'));

// ---- 4) systemd 单元 ----
fs.writeFileSync(path.join(PKG, NAME + '.service'), `[Unit]
Description=ArborInversa Cloud（逆生树云端：账号 ＋ 树）
After=network.target

[Service]
Type=simple
User=arbor
Group=arbor
ExecStart=/usr/bin/node /opt/${NAME}/cloud-server.js --port __PORT__ --host 127.0.0.1 --root /var/lib/${NAME} --site /opt/${NAME}/site
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
`);

// ---- 5) 安装脚本 ----
fs.writeFileSync(path.join(PKG, '安装.sh'), `#!/bin/sh
# 逆生树 · 云端 —— 一键安装（可反复跑）
#   sudo sh 安装.sh [端口]     默认 8488
# 装到 /opt/${NAME}，数据在 /var/lib/${NAME}，服务名 ${NAME}
set -e
PORT="\${1:-8488}"
HERE=$(cd "$(dirname "$0")" && pwd)
DIR=/opt/${NAME}
DATA=/var/lib/${NAME}
NODE=$(command -v node || true)

echo "== 逆生树 · 云端 安装 =="
if [ -z "$NODE" ]; then
  echo "× 没找到 node。先装：apt-get install -y nodejs   （或 yum install -y nodejs）"
  exit 1
fi
echo "· node: $NODE ($($NODE -v))"
echo "· 端口: $PORT   程序: $DIR   数据: $DATA"

if ! id -u arbor >/dev/null 2>&1; then
  echo "· 建系统用户 arbor"
  useradd -r -s /usr/sbin/nologin arbor 2>/dev/null || adduser -S -D -H arbor
fi

mkdir -p "$DIR" "$DATA"
cp -r "$HERE/site" "$DIR/"
cp "$HERE/cloud-server.js" "$DIR/"
chown -R arbor:arbor "$DATA"

sed "s|__PORT__|$PORT|g" "$HERE/${NAME}.service" > /etc/systemd/system/${NAME}.service
chmod 644 /etc/systemd/system/${NAME}.service
systemctl daemon-reload
systemctl enable ${NAME} >/dev/null 2>&1 || true
systemctl restart ${NAME}
sleep 1

echo "· 自检："
if curl -s --max-time 5 "http://127.0.0.1:$PORT/api/health" | grep -q '"ok":true'; then
  echo "  ✓ 接口通了"
else
  echo "  × 接口没通 —— 看日志：journalctl -u ${NAME} -n 40 --no-pager"
fi
if curl -sI --max-time 5 "http://127.0.0.1:$PORT/" | head -1 | grep -q 200; then
  echo "  ✓ 网页发得出去"
else
  echo "  × 网页没发出去"
fi

echo
echo "装好了。接下来："
echo "  1) 放行端口：云厂商安全组开 $PORT；本机防火墙 ufw allow $PORT/tcp（或 firewall-cmd --add-port=$PORT/tcp --permanent && firewall-cmd --reload）"
echo "  2) 从别的机器验：curl http://<这台机的公网IP>:$PORT/api/health"
echo "  3) 浏览器打开 http://<公网IP>:$PORT/ 就是应用"
echo "  4) 备份：tar czf ${NAME}-\\$(date +%F).tar.gz -C /var/lib ${NAME}   （★ .secret 一定要一起备）"
echo "  看日志：journalctl -u ${NAME} -f"
`);

// ---- 6) 说明 ----
fs.copyFileSync(path.join(__dirname, 'cloud-部署.md'), path.join(PKG, '说明.md'));

// ---- 7) 打 tar.gz ----
const tarball = path.join(OUTDIR, NAME + '.tar.gz');
cp.execFileSync('tar', ['czf', tarball, '-C', OUTDIR, NAME]);

// ---- 自检 ----
const 检查 = [
  ['服务端在', fs.existsSync(path.join(PKG, 'cloud-server.js'))],
  ['网页在', fs.existsSync(path.join(PKG, 'site/index.html'))],
  ['systemd 单元在', fs.existsSync(path.join(PKG, NAME + '.service'))],
  ['安装脚本在', fs.existsSync(path.join(PKG, '安装.sh'))],
  ['说明在', fs.existsSync(path.join(PKG, '说明.md'))],
  ['压缩包在', fs.existsSync(tarball)],
  ['服务端只 require 内置模块（不用 npm install）', (function () {
    const src = fs.readFileSync(path.join(PKG, 'cloud-server.js'), 'utf8');
    const 内置 = new Set(require('module').builtinModules);
    const 用到的 = [...src.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(x => x[1]);
    const 外部的 = 用到的.filter(n => !内置.has(n.replace(/^node:/, '')));
    if (外部的.length) console.log('    外部依赖：' + 外部的.join('、'));
    return 外部的.length === 0;
  })()],
];
let bad = 0;
for (const [名, ok] of 检查) { console.log((ok ? '  ✓ ' : '  × ') + 名); if (!ok) bad++; }
const 大小 = n => (fs.statSync(n).size / 1024).toFixed(0) + ' KB';
console.log('\n成品：' + path.relative(REPO, tarball) + '（' + 大小(tarball) + '），解开是 ' + path.relative(REPO, PKG) + '/');
if (bad) { console.error('有 ' + bad + ' 项自检没过'); process.exit(1); }
console.log('✓ 可以直接把压缩包丢给服务器维护者');
