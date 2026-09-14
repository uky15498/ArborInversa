// 内容自检（改完跑一次；pre-commit 钩子用）
//
// 仓库是**纯框架**：不放任何内容。所以这里只做两件事：
//   ① 核对仓库 data.json —— 合法 JSON、含 name、且必须是**空框架树**（根下没有枝）
//   ② 校验应用数据 —— JSON 结构、叶、属性值类型、[[跳转]] 是否都指向存在的枝
//
// 用法：
//   node tools/check_data.js                 # ① ＋ ②
//   node tools/check_data.js --repo-only     # 只跑 ①（换台机器、仓库里没有应用数据时用）
//   node tools/check_data.js --data <文件>   # 指定应用数据（默认 /mnt/c/ArborInversa/data.json）
//
// 退出码：0 通过；1 不通过
const fs = require('fs'), path = require('path');

const REPO = path.join(__dirname, '..');
const FRAME = path.join(REPO, 'data.json');
const args = process.argv.slice(2);
const REPO_ONLY = args.includes('--repo-only');
const i = args.indexOf('--data');
const APP_DATA = i >= 0 && args[i + 1] ? args[i + 1] : (process.env.DATA || '/mnt/c/ArborInversa/data.json');

function die(msg) { console.log('× ' + msg); process.exit(1); }
const stat = v => ['枝 ' + v.branches, '叶 ' + v.leaves, '属性 ' + v.props, '链接 ' + v.links].join(' | ');

// ---------- ① 仓库 data.json：空框架树 ----------
if (!fs.existsSync(FRAME)) die('仓库里没有 data.json（应为空框架树）');
let frame;
try { frame = JSON.parse(fs.readFileSync(FRAME, 'utf8')); }
catch (e) { die('仓库 data.json 不是合法 JSON：' + e.message); }
if (!frame.name) die('仓库 data.json 缺少 name 字段');
const kids = (frame.children || []).length;
if (kids !== 0) {
  die('仓库 data.json 不是空框架树（根下挂着 ' + kids + ' 枝）——\n' +
      '  仓库只放框架：data.json 必须是空树，内容留在你自己的应用目录里');
}
console.log('✓ 仓库 data.json 是空框架树（根「' + frame.name + '」＋ ' +
            (frame.leaves || []).length + ' 片引导叶，' + fs.statSync(FRAME).size + ' 字节）');

if (REPO_ONLY) process.exit(0);

// ---------- ② 应用数据 ----------
if (!fs.existsSync(APP_DATA)) {
  console.log('· 没找到应用数据（' + APP_DATA + '），跳过内容校验'); 
  console.log('  （换台机器上跑就加 --repo-only，或临时用 --data <文件> 指定）');
  process.exit(0);
}

/** 校验一棵树：结构、属性值类型、[[跳转]] 是否都有效 */
function validate(raw) {
  let d;
  try { d = JSON.parse(raw); } catch (e) { die('应用数据不是合法 JSON：' + e.message); }
  if (!d.name) die('应用数据缺少 name 字段');
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
        if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
          badProps.push(n.name + '.' + k + '（空值）');
        }
      });
    }
    if (n.children !== undefined && !Array.isArray(n.children)) die(n.name + ' 的 children 不是数组');
    (n.children || []).forEach(walk);
  })(d);
  (function walk(n) {
    (n.leaves || []).forEach(l => {
      const t = String(l.desc || '').replace(/!\[\[[^\]]+\]\]/g, '');   // 先剔掉插图再查链接
      for (const m of t.matchAll(/\[\[([^\]]+)\]\]/g)) {
        links++;
        if (!names.has(m[1])) badLinks.push(m[1]);
      }
    });
    (n.children || []).forEach(walk);
  })(d);
  return { data: d, branches, leaves, props, links,
           badLinks: [...new Set(badLinks)], badProps: [...new Set(badProps)] };
}

const v = validate(fs.readFileSync(APP_DATA, 'utf8'));
if (v.badLinks.length) die('有无效的 [[跳转]] 链接：' + v.badLinks.join('、'));
if (v.badProps.length) die('属性值不合法（单值写文本、多值写数组，且不得为空）：' + v.badProps.join('、'));
console.log('✓ 应用数据 OK（' + stat(v) + '）');
