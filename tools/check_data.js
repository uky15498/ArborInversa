// 内容自检（改完跑一次；pre-commit 钩子用）
//
// 仓库里装的是**框架自带的示例树**，不是任何个人内容。所以这里做三件事：
//   ① 核对仓库 data.json ＝ 由《示例树.txt》生成的那棵树（在不在一条线上、有没有被个人内容顶掉）
//   ② 校验应用数据（你自己的内容）：JSON 结构、叶、属性值类型、[[跳转]] 是否有效
//   ③ 顺手报告两者的规模
//
// 用法：
//   node tools/check_data.js                 # ① ＋ ②
//   node tools/check_data.js --repo-only     # 只跑 ①（别的机器/仓库里没有应用数据时用，钩子用的就是它）
//   node tools/check_data.js --write         # 由《示例树.txt》重新生成仓库 data.json（改了示例树就跑它）
//   node tools/check_data.js --data <文件>   # 指定应用数据（默认 /mnt/c/ArborInversa/data.json）
//
// 退出码：0 通过；1 不通过
const fs = require('fs'), path = require('path');
const { loadCodec } = require('./codec-from-html');

const REPO = path.join(__dirname, '..');
const FRAME = path.join(REPO, 'data.json');        // 仓库那份：示例树的 JSON 形式
const DEMO = path.join(REPO, '示例树.txt');        // 仓库那份：示例树的文本代码形式（唯一来源）
const args = process.argv.slice(2);
const REPO_ONLY = args.includes('--repo-only');
const WRITE = args.includes('--write');
const i = args.indexOf('--data');
const APP_DATA = i >= 0 && args[i + 1] ? args[i + 1] : (process.env.DATA || '/mnt/c/ArborInversa/data.json');

function die(msg) { console.log('× ' + msg); process.exit(1); }
const stat = v => ['枝 ' + v.branches, '叶 ' + v.leaves, '属性 ' + v.props, '链接 ' + v.links].join(' | ');

/** 由《示例树.txt》算出仓库 data.json 应该长什么样 */
function demoData() {
  if (!fs.existsSync(DEMO)) die('找不到示例树：' + DEMO);
  const { codeToTree } = loadCodec();
  const text = fs.readFileSync(DEMO, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const root = codeToTree(text).children[0];
  if (!root) die('示例树里没有枝 —— 至少要有一根「枝 名称」');
  const d = { name: root.name, leaves: root.leaves || [], children: root.children || [] };
  if (root.props && Object.keys(root.props).length) d.props = root.props;
  return d;
}

// ---------- ① 仓库 data.json ＝ 示例树 ----------
const want = demoData();
const wantJSON = JSON.stringify(want);
if (WRITE) {
  fs.writeFileSync(FRAME, wantJSON, 'utf8');       // 与程序写出格式一致：compact、UTF-8 无 BOM
  console.log('✓ 已由《示例树.txt》重新生成仓库 data.json（' + fs.statSync(FRAME).size + ' 字节）');
} else {
  if (!fs.existsSync(FRAME)) die('仓库里没有 data.json —— 跑 node tools/check_data.js --write 生成');
  let got;
  try { got = JSON.parse(fs.readFileSync(FRAME, 'utf8')); }
  catch (e) { die('仓库 data.json 不是合法 JSON：' + e.message); }
  if (JSON.stringify(got) !== wantJSON) {
    die('仓库 data.json 与《示例树.txt》不一致 ——\n' +
        '  仓库里装的应该是**框架自带的示例树**（不是个人内容）。改示例树后请跑：\n' +
        '    node tools/check_data.js --write');
  }
  let br = 0, lv = 0;
  (function w(n) { br++; lv += (n.leaves || []).length; (n.children || []).forEach(w); })(got);
  console.log('✓ 仓库 data.json ＝ 示例树（根「' + got.name + '」，' + br + ' 枝／' + lv + ' 叶，' +
              fs.statSync(FRAME).size + ' 字节）');
}

if (REPO_ONLY) process.exit(0);

// ---------- ② 应用数据（你自己的内容）----------
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
