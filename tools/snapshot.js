// 把「应用版」内容快照进仓库：C:\ArborInversa\data.json → <repo>/data.json（media/ 同步）
//
// 用途：内容的正本一直在应用目录（C:\ArborInversa\），git 只跟踪这份**快照**，
//       这样提交历史里就有内容的完整版本；**绝不反向覆盖应用版**。
//
// 用法：
//   node tools/snapshot.js            # 校验 + 拷贝（有变化才写）
//   node tools/snapshot.js --check    # 只校验是否一致，不写（给 pre-commit 用）
//   node tools/snapshot.js --force    # 允许把「几乎是空树」的数据写进库（默认拒绝，防手滑）
//
// 退出码：0＝一致／已同步；1＝校验失败或（--check 时）不一致
const fs = require('fs'), path = require('path');

const APP    = process.env.APP_DIR || '/mnt/c/ArborInversa';
const REPO   = path.join(__dirname, '..');
const SRC    = path.join(APP, 'data.json');
const DST    = path.join(REPO, 'data.json');
const CHECK  = process.argv.includes('--check');
const FORCE  = process.argv.includes('--force');

function die(msg) { console.log('× ' + msg); process.exit(1); }

// ---------- 校验 ----------
function validate(raw) {
  let d;
  try { d = JSON.parse(raw); } catch (e) { die('应用版 data.json 不是合法 JSON：' + e.message); }
  if (!d.name) die('数据缺少 name 字段');
  const names = new Set(); let branches = 0, leaves = 0, props = 0, links = 0;
  const badLinks = [], badProps = [];
  (function walk(n) {
    branches++; names.add(n.name);
    if (n.leaves !== undefined && !Array.isArray(n.leaves)) die(n.name + ' 的 leaves 不是数组');
    leaves += (n.leaves || []).length;
    if (n.props !== undefined) {
      if (typeof n.props !== 'object' || Array.isArray(n.props)) die(n.name + ' 的 props 不是对象');
      Object.keys(n.props).forEach(k => {
        props++;
        const v = n.props[k];
        const ok = typeof v === 'string' ||
          (Array.isArray(v) && v.length > 1 && v.every(x => typeof x === 'string'));
        if (!ok) badProps.push(n.name + '.' + k);
        if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) badProps.push(n.name + '.' + k + '（空值）');
      });
    }
    if (n.children !== undefined && !Array.isArray(n.children)) die(n.name + ' 的 children 不是数组');
    (n.children || []).forEach(walk);
  })(d);
  (function walk(n) {
    (n.leaves || []).forEach(l => {
      const t = String(l.desc || '').replace(/!\[\[[^\]]+\]\]/g, '');
      for (const m of t.matchAll(/\[\[([^\]]+)\]\]/g)) { links++; if (!names.has(m[1])) badLinks.push(m[1]); }
    });
    (n.children || []).forEach(walk);
  })(d);
  return { data: d, branches, leaves, props, links, badLinks: [...new Set(badLinks)], badProps };
}

// ---------- 同步 ----------
if (!fs.existsSync(SRC)) die('找不到应用版数据：' + SRC);
const raw = fs.readFileSync(SRC, 'utf8');
const v = validate(raw);

if (v.badLinks.length) die('有无效的 [[跳转]] 链接：' + v.badLinks.join('、'));
if (v.badProps.length) die('属性值不合法（单值要写成文本、多值写成数组且不得为空）：' + v.badProps.join('、'));
if (v.branches < 5 && !FORCE) {
  die('这份数据只有 ' + v.branches + ' 个枝，看起来是外发版的空树 —— 拒绝写进仓库' +
      '（确实要写就加 --force）');
}

const stat = [
  '枝 ' + v.branches, '叶 ' + v.leaves, '属性 ' + v.props, '链接 ' + v.links
].join(' | ');
const old = fs.existsSync(DST) ? fs.readFileSync(DST, 'utf8') : null;
const same = old !== null && JSON.parse(old).name === v.data.name &&
             JSON.stringify(JSON.parse(old)) === JSON.stringify(v.data);

if (CHECK) {
  if (!same) { console.log('× 库内 data.json 与应用版不一致（' + stat + '）—— 先跑 node tools/snapshot.js'); process.exit(1); }
  console.log('✓ 库内 data.json 与应用版一致（' + stat + '）');
  process.exit(0);
}

if (same) console.log('= data.json 无变化（' + stat + '）');
else { fs.writeFileSync(DST, raw, 'utf8'); console.log('✓ 已同步 data.json（' + stat + '）'); }

// media/ 也一并同步（只拷贝新增或大小不同的）
const mSrc = path.join(APP, 'media'), mDst = path.join(REPO, 'media');
let copied = 0, skipped = 0;
if (fs.existsSync(mSrc)) {
  fs.mkdirSync(mDst, { recursive: true });
  for (const f of fs.readdirSync(mSrc)) {
    const a = path.join(mSrc, f), b = path.join(mDst, f);
    const sa = fs.statSync(a);
    if (!sa.isFile()) continue;
    if (fs.existsSync(b) && fs.statSync(b).size === sa.size) { skipped++; continue; }
    fs.copyFileSync(a, b); copied++;
    console.log('   + media/' + f);
  }
}
console.log('   media：新增/更新 ' + copied + '，未变 ' + skipped);
