// 生成「网页便携版」：把一棵树的内容嵌进 index.html，做成单文件
//
// 用法：
//   node tools/build_web.js                           # 用仓库示例树 → dist/ArborInversa-在线版.html
//   node tools/build_web.js 我的树.txt                 # 用树语言文本
//   node tools/build_web.js /mnt/c/ArborInversa/data.json   # 也可以直接吃 data.json（自动转成树语言）
//   node tools/build_web.js 输入 输出.html              # 指定输出路径
//   node tools/build_web.js --check                     # 核对 docs/index.html（线上那份）是不是最新的
//   node tools/build_web.js 示例树.txt docs/index.html   # 重新生成线上那份（改了 index.html 或示例树就跑它）
//
// 产物：一个自包含的 HTML —— 双击（file://）就能用，不需要后端、不需要联网。
//   内容写在该文件末尾的 <script id="tree-data"> 里，是**树语言文本**：
//   人可读、可 diff、可以直接复制出去，也可以粘回仓库。
//
// 注意：含个人内容的产物默认落在 dist/（已在 .gitignore 里），不会误提交。
const fs = require('fs'), path = require('path');
const { loadCodec } = require('./codec-from-html');

const REPO = path.join(__dirname, '..');
const HTML = path.join(REPO, 'index.html');
const STORE = path.join(__dirname, 'portable-store.js');
const DEMO = path.join(REPO, '示例树.txt');
const DIST = path.join(REPO, 'dist');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const pos = args.filter(a => !a.startsWith('--'));
// 线上那份（GitHub Pages 用的就是它）：docs/index.html ＋ docs/media/
const DOCS = path.join(REPO, 'docs', 'index.html');
const input = pos[0] || (CHECK ? DEMO : DEMO);
const out = pos[1] || (CHECK ? DOCS : path.join(DIST, 'ArborInversa-在线版.html'));

const { treeToCode, codeToTree } = loadCodec();

// ---------- 1) 取内容，统一成树语言文本 ----------
if (!fs.existsSync(input)) {
  console.error('× 找不到输入：' + input);
  process.exit(1);
}
const raw = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
let text;
if (input.endsWith('.json')) {
  const d = JSON.parse(raw);                       // 数据正本 → 树语言文本（这就是「JSON 只是内部表示」）
  text = treeToCode(d, 0);
} else {
  text = raw;
}
// 用真实实现验一遍：解析得出枝，再回转稳定（内容不会因为包装一次就变样）
const parsed = codeToTree(text);
const root = (parsed.children && parsed.children.length) ? parsed.children[0]
           : (parsed.title ? { name: parsed.title, leaves: parsed.leaves || [], children: [], props: parsed.props } : null);
if (!root || !root.name) {
  console.error('× 这份内容里没有枝，做不出便携版');
  process.exit(1);
}
const canonical = treeToCode(root, 0);
const stat = (function count(n) {
  let b = 1, l = (n.leaves || []).length, p = Object.keys(n.props || {}).length;
  (n.children || []).forEach(c => { const s = count(c); b += s.b; l += s.l; p += s.p; });
  return { b, l, p };
})(root);

// ---------- 2) 拼装 ----------
let html = fs.readFileSync(HTML, 'utf8');
const store = fs.readFileSync(STORE, 'utf8');

// 2a) 存取层：必须在 app 脚本**之前**，否则 const Store 取不到 window.ArborStore
const anchor = '<script>\n// ---- 存取：内容从哪读、往哪写 ----';
if (!html.includes(anchor)) {
  console.error('× index.html 的结构变了：找不到 app 脚本的锚点');
  process.exit(1);
}
html = html.replace(anchor, '<script>\n' + store + '\n</script>\n\n' + anchor);

// 2b) 导出面板（静态标记，这样「另存为整份 HTML」时它能被一起带出去）
const panel = `
<div class="modal" id="exportModal">
  <div class="box">
    <h3>导出</h3>
    <div class="where" id="exportWhere"></div>
    <div class="linkrow">
      <a id="exportCopy">复制树语言文本</a>
      <a id="exportTxt">下载 .txt</a>
      <a id="exportHtml">另存为整份 HTML</a>
      <a id="exportReset">丢掉改动</a>
    </div>
    <div class="shelp">
      下面就是你的内容，<b>树语言文本</b>：竖向的「枝」用缩进表示层级，「叶」是挂在枝下的正文。
      复制它、存成 .txt、或整份 HTML 另存为，都等于保存。<br>
      想接着在别的设备上改：把这个 HTML（或这段文本）带走就行。
    </div>
    <textarea id="exportText" class="code" readonly spellcheck="false"></textarea>
    <div class="acts"><button id="exportClose" class="primary">关闭</button></div>
  </div>
</div>
`;
html = html.replace('<div class="toast" id="toast"></div>', panel + '<div class="toast" id="toast"></div>');

// 2c) 负载块：内容写成树语言文本，挂在文件末尾（以后改内容，diff 就出现在最后）
const escaped = canonical.replace(/<\//g, '<\\/');      // 只有 `</` 会截断 <script>，转义它
html = html.replace('</body>',
  '<script id="tree-data" type="text/plain">\n' + escaped + '\n</script>\n</body>');

// 2d) 绑定导出面板上的按钮
const wire = `
<script>
// 此刻整个文档（含上面的负载块）都解析完了，而渲染还没开始（渲染要等 DOMContentLoaded）
// —— 所以这一份就是「原样源码」，导出整份 HTML 时只换掉负载块即可。
window.__ARBOR_SRC__ = "<!DOCTYPE html>\\n" + document.documentElement.outerHTML;
window.addEventListener("load", function () {
  var E = window.__arborExport;
  var bind = function (id, fn) { var el = document.getElementById(id); if (el) el.onclick = fn; };
  bind("exportCopy", function () { E.copy(); });
  bind("exportTxt", function () { E.txt(); });
  bind("exportHtml", function () { E.html(); });
  bind("exportReset", function () { E.reset(); document.getElementById("exportModal").classList.remove("show"); });
  bind("exportClose", function () { document.getElementById("exportModal").classList.remove("show"); });
  var m = document.getElementById("exportModal");
  if (m) m.onclick = function (e) { if (e.target === m) m.classList.remove("show"); };
});
</script>
`;
html = html.replace('</body>', wire + '</body>');

// ---------- 3) 自检 ----------
const checks = [];
checks.push(['内嵌负载解析得回同一棵树', (function () {
  const back = codeToTree(escaped.replace(/<\\\//g, '</'));
  const r2 = back.children && back.children.length ? back.children[0] : null;
  return !!r2 && treeToCode(r2, 0) === canonical;
})()]);
checks.push(['负载里不含会截断容器的序列', !/<\/(script|style)/i.test(escaped)]);
checks.push(['存取层已在 app 脚本之前', html.indexOf('window.ArborStore') < html.indexOf('const Store = window.ArborStore')]);
checks.push(['导出面板已就位', html.includes('id="exportModal"') && html.includes('id="exportText"')]);
checks.push(['负载块挂在末尾', html.lastIndexOf('id="tree-data"') > html.indexOf('id="exportText"')]);
checks.push(['存取层源码里没有会截断内联脚本的字面量', !/<!\/script/i.test(store)]);
checks.push(['抓源码的那一行在负载块之后', html.indexOf('window.__ARBOR_SRC__ = "<!DOCTYPE') > html.lastIndexOf('id="tree-data"')]);

// 把产物里的内联脚本抠出来逐个做语法检查 —— 能同时抓住两类坑：
//   ① 源码里出现字面量 </script>（内联脚本被当场截断）
//   ② 生成脚本时的转义写错（比如模板字符串里的 \n 变成了真空行）
function jsSyntaxErrors(page) {
  const bad = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(page)) !== null) {
    if (/type\s*=\s*"(text\/plain|application\/json)"/.test(m[1])) continue;   // 负载块不是 JS
    try { new Function(m[2]); } catch (e) { bad.push((m[1].trim() || '(无属性)') + ' → ' + e.message); }
  }
  return bad;
}
const syntaxBad = jsSyntaxErrors(html);
checks.push(['产物里的内联脚本都能通过语法检查', syntaxBad.length === 0]);

if (CHECK) {
  if (!fs.existsSync(out)) { console.error('× 还没有 ' + path.relative(REPO, out) + ' —— 跑：node tools/build_web.js 示例树.txt docs/index.html'); process.exit(1); }
  const cur = fs.readFileSync(out, 'utf8');
  if (cur !== html) {
    console.error('× ' + path.relative(REPO, out) + ' 与当前 index.html／输入不一致（线上那份过期了）');
    console.error('  （可能是改了 index.html 或示例树之后忘了重新生成）跑：');
    console.error('    node tools/build_web.js ' + path.relative(REPO, input) + ' ' + path.relative(REPO, out));
    process.exit(1);
  }
  console.log('✓ ' + path.relative(REPO, out) + ' 是最新的（与 index.html ＋ ' + path.basename(input) + ' 一致）');
  process.exit(0);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, 'utf8');

const bad = checks.filter(c => !c[1]);
console.log(`输入：${path.relative(REPO, input) || input}`);
console.log(`内容：枝 ${stat.b} ／ 叶 ${stat.l} ／ 属性 ${stat.p}　（树语言 ${canonical.split('\n').length} 行）`);
console.log(`产物：${path.relative(REPO, out)}　${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
checks.forEach(c => console.log('  ' + (c[1] ? '✓' : '×') + ' ' + c[0]));
if (syntaxBad.length) syntaxBad.forEach(x => console.error('    内联脚本语法错误：' + x));
if (bad.length) { console.error('× 自检没过，产物不可信'); process.exit(1); }
console.log('✓ 便携版已生成 —— 双击即可打开，不需要后端');
// 线上那份还要把示例树用到的插图放到同级 media/（浏览器没法列目录，路径得对得上）
if (path.resolve(out) === path.resolve(DOCS)) {
  const src = path.join(REPO, 'media'), dst = path.join(path.dirname(out), 'media');
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(src)) { fs.copyFileSync(path.join(src, f), path.join(dst, f)); n++; }
  console.log('  同步插图 ' + n + ' 个 → ' + path.relative(REPO, dst) + '/');
}
