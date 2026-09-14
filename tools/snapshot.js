// 提交前的内容自检与快照（2026-09-14 起：仓库的门面＝框架，美术史只以「示例」出现）
//
// 做四件事：
//   1) 校验**应用版**数据（C:\ArborInversa\data.json）：JSON／叶／属性值类型／[[跳转]] 是否有效
//   2) 把应用版的 media/ 同步进库（只补新增或大小不同的）
//   3) 由应用数据重新生成 git 上的「示例」页 → <repo>/示例.md（美术史在库里的唯一落点）
//   4) 核对仓库 data.json 仍是**空框架树**（防止谁把个人内容又写回去）
//
// 用法：
//   node tools/snapshot.js            # 校验 + 同步 media/ + 重新生成示例页
//   node tools/snapshot.js --check    # 只检查是否都一致，不写（pre-commit 钩子用的就是它）
//   node tools/snapshot.js --force    # 允许用「几乎是空树」的数据生成示例页（默认拒绝，防手滑）
//
// 退出码：0＝一致／已同步；1＝校验失败或（--check 时）不一致
const fs = require('fs'), path = require('path');
const { build: buildExamplePage } = require('./make_example_page');

const APP    = process.env.APP_DIR || '/mnt/c/ArborInversa';
const REPO   = path.join(__dirname, '..');
const SRC    = path.join(APP, 'data.json');
const FRAME  = path.join(REPO, 'data.json');        // 仓库那份：空框架树
const PAGE   = path.join(REPO, '示例.md');          // 仓库那份：示例页（生成物）
const CHECK  = process.argv.includes('--check');
const FORCE  = process.argv.includes('--force');

function die(msg) { console.log('× ' + msg); process.exit(1); }

// ---------- 校验应用版数据 ----------
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

// ---------- 1) 校验 ----------
if (!fs.existsSync(SRC)) die('找不到应用版数据：' + SRC);
const v = validate(fs.readFileSync(SRC, 'utf8'));

if (v.badLinks.length) die('有无效的 [[跳转]] 链接：' + v.badLinks.join('、'));
if (v.badProps.length) die('属性值不合法（单值要写成文本、多值写成数组且不得为空）：' + v.badProps.join('、'));
if (v.branches < 5 && !FORCE) {
  die('这份数据只有 ' + v.branches + ' 个枝，看起来不是正式内容 —— 拒绝拿它生成示例页' +
      '（确实要生成就加 --force）');
}

const stat = ['枝 ' + v.branches, '叶 ' + v.leaves, '属性 ' + v.props, '链接 ' + v.links].join(' | ');

// ---------- 2) 核对仓库 data.json 是空框架树 ----------
if (!fs.existsSync(FRAME)) die('仓库里没有 data.json（应为空框架树）');
let frame;
try { frame = JSON.parse(fs.readFileSync(FRAME, 'utf8')); } catch (e) { die('仓库 data.json 不是合法 JSON：' + e.message); }
const fwBranches = 1 + (frame.children || []).length;
if ((frame.children || []).length !== 0) {
  die('仓库 data.json 不是空框架树（下含 ' + (frame.children || []).length + ' 枝）——\n' +
      '  仓库的门面是「框架」：data.json 只放空树，美术史内容请留在 示例.md（由应用数据生成）');
}
if (JSON.stringify(frame) === JSON.stringify(v.data)) {
  die('仓库 data.json 与应用版完全相同 —— 说明个人内容被写进了仓库，请恢复为空框架树');
}

// ---------- 3) 重新生成示例页 ----------
let page;
try { page = buildExamplePage().md; } catch (e) { die('生成示例页失败：' + e.message); }
const oldPage = fs.existsSync(PAGE) ? fs.readFileSync(PAGE, 'utf8') : null;
const pageSame = oldPage === page;

// ---------- 4) media/ 同步（只在非 --check 时写） ----------
const mSrc = path.join(APP, 'media'), mDst = path.join(REPO, 'media');
const mediaPlan = [];
if (fs.existsSync(mSrc)) {
  for (const f of fs.readdirSync(mSrc)) {
    const a = path.join(mSrc, f), b = path.join(mDst, f);
    if (!fs.statSync(a).isFile()) continue;
    if (fs.existsSync(b) && fs.statSync(b).size === fs.statSync(a).size) continue;
    mediaPlan.push(f);
  }
}

// ---------- 汇总 ----------
if (CHECK) {
  let bad = 0;
  if (!pageSame) { console.log('× 库内 示例.md 与应用数据不一致（' + stat + '）—— 先跑：node tools/snapshot.js'); bad++; }
  if (mediaPlan.length) { console.log('× 库内 media/ 少了或有变化：' + mediaPlan.join('、') + ' —— 先跑：node tools/snapshot.js'); bad++; }
  if (bad) process.exit(1);
  console.log('✓ 示例页与 media/ 都与应用数据一致（' + stat + '）');
  console.log('✓ 仓库 data.json 是空框架树（' + fwBranches + ' 个枝，仅根）');
  process.exit(0);
}

if (pageSame) console.log('= 示例.md 无变化（' + stat + '）');
else {
  fs.writeFileSync(PAGE, page, 'utf8');
  console.log('✓ 已重新生成 示例.md（' + stat + '，' + Buffer.byteLength(page) + ' 字节）');
}
for (const f of mediaPlan) {
  fs.mkdirSync(mDst, { recursive: true });
  fs.copyFileSync(path.join(mSrc, f), path.join(mDst, f));
  console.log('   + media/' + f);
}
console.log('   media：新增/更新 ' + mediaPlan.length);
console.log('   仓库 data.json：空框架树 ✓（未被改动）');
