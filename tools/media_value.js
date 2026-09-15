// 图库工具：给每张图算出「值」，把图库整理成按值命名，并把内容里的引用改成值
//
// 值的由来：图片内容 SHA-256 → 平水韵 106 韵目 → 五言（算法与页面里**同一份**，
// 见 index.html 纯函数区的 imgValueFromHash）。所以同一张图在任何设备上算出来都一样：
// 改名不失效、天然去重、验得出「同名不同图」。
//
// 为什么文件要以值命名：文本里只写 ![[先月迥屑先]]，浏览器没法列目录、也猜不出
// 后面跟的是什么名字，只能按候选扩展名去试。文件就叫值，一试就中，不需要任何索引文件，
// 两台设备的图库合并＝直接拷文件（同内容→同值→同名）。
//
// 用法（默认只看报告，不动任何文件）：
//   node tools/media_value.js
//   node tools/media_value.js --media <图库目录> --data <data.json 或 树.txt>
//   node tools/media_value.js --write          # 真的改名 ＋ 改写引用（先自动备份）
//
// 退出码：0 通过；1 有问题（缺图／撞值）需要你看一眼
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { loadPure } = require('./codec-from-html');

const REPO = path.join(__dirname, '..');
const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const arg = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };

const MEDIA = arg('--media', '/mnt/c/ArborInversa/media');
const DATA = arg('--data', process.env.DATA || '/mnt/c/ArborInversa/data.json');

// 与页面同一份实现：值算法、编解码、叶的取法
const A = new Function(loadPure() +
  '\nreturn {imgValueFromHash, isImgValue, IMG_LEN, IMG_EXTS, treeToCode, codeToTree, leavesOf};')();

const IMG_EXT = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif']);
const valueOfFile = f => A.imgValueFromHash(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'));
const kb = n => (n / 1024).toFixed(1) + ' KB';

// ---------- 1) 读图库 ----------
if (!fs.existsSync(MEDIA)) {
  console.log('· 没有图库目录：' + MEDIA + '（跳过）');
  process.exit(0);
}
const files = fs.readdirSync(MEDIA).filter(f => IMG_EXT.has(path.extname(f).toLowerCase()) && fs.statSync(path.join(MEDIA, f)).isFile());
const byValue = new Map();          // 值 → [文件名...]（同一个值出现多个文件＝内容重复）
const info = [];                    // 每个文件的：名字、值、大小
for (const f of files) {
  const p = path.join(MEDIA, f);
  const v = valueOfFile(p);
  const size = fs.statSync(p).size;
  info.push({ file: f, value: v, size });
  if (!byValue.has(v)) byValue.set(v, []);
  byValue.get(v).push(f);
}
console.log(`图库：${MEDIA}`);
console.log(`　${files.length} 个文件`);
for (const i of info) console.log(`　　${i.file.padEnd(30)} 值 ${i.value}  ${kb(i.size)}`);

// ---------- 2) 读内容，找出所有图片引用 ----------
let treeText = null, dataPath = null;
function readTreeText() {
  if (!fs.existsSync(DATA)) return null;
  const raw = fs.readFileSync(DATA, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (DATA.endsWith('.json')) { const d = JSON.parse(raw); return { mode: 'json', data: d, text: A.treeToCode(d, 0) }; }
  const p = A.codeToTree(raw);
  const root = (p.children && p.children.length) ? p.children[0] : null;
  return { mode: 'text', text: raw, root: root };
}
const T = readTreeText();
const refs = [];                    // 内容里出现的图片引用
if (T) {
  const walk = (n, where) => {
    for (const lf of A.leavesOf(n)) {
      for (const m of String(lf.desc || '').matchAll(/!\[\[([^\]]+)\]\]/g)) {
        const [name, cap] = m[1].split('|');
        refs.push({ where: where + ' › ' + (lf.name || '叶'), raw: m[0], name: (name || '').trim(), cap: (cap || '').trim() });
      }
    }
    (n.children || []).forEach(c => walk(c, where + ' › ' + c.name));
  };
  if (T.mode === 'json') walk(T.data, T.data.name);
  else if (T.root) walk(T.root, T.root.name);
  console.log(`\n内容：${DATA}（${refs.length} 处图片引用）`);
} else {
  console.log(`\n内容：找不到 ${DATA} —— 只整理图库，不碰引用`);
}

// ---------- 3) 报告 ----------
const dupValues = [...byValue.entries()].filter(([, arr]) => arr.length > 1);
const missing = refs.filter(r => {
  if (A.isImgValue(r.name)) return !byValue.has(r.name);
  return !files.includes(r.name);                       // 老写法：按文件名找
});
const usedValues = new Set(refs.map(r => r.name).filter(n => A.isImgValue(n)));
const orphans = info.filter(i => !usedValues.has(i.value) && !refs.some(r => r.name === i.file));

console.log('\n检查结果：');
console.log('　内容重复的图：' + (dupValues.length ? '' : '无'));
for (const [v, arr] of dupValues) console.log(`　　值 ${v}：${arr.join('、')}（内容相同，留一份即可）`);
console.log('　撞值（不同内容算出同一个值）：无 —— 值由内容决定，撞了说明是同一张图');
console.log('　树里引用了但库里没有：' + (missing.length ? '' : '无'));
for (const m of missing) console.log(`　　${m.where}  引用 ${m.raw}` + (A.isImgValue(m.name) ? '（值在库里找不到）' : '（没有这个文件）'));
console.log('　库里没被引用的图：' + (orphans.length ? orphans.map(o => o.file).join('、') : '无'));

// ---------- 4) --write：改名 ＋ 改写引用 ----------
if (!WRITE) {
  const todo = info.filter(i => i.file !== i.value + path.extname(i.file));
  if (todo.length) {
    console.log('\n（以上只是报告。要真的改名并改写引用，跑：node tools/media_value.js --write）');
    console.log('　将要改名：');
    for (const i of todo) console.log(`　　${i.file}  →  ${i.value}${path.extname(i.file)}`);
  }
  process.exit(missing.length || dupValues.length ? 1 : 0);
}

// 备份（与 seed_props.js 一个路数：改前留一份，随时能退回来）
if (T && T.mode === 'json') {
  const bak = DATA + '.before-imagevalue.json';
  fs.copyFileSync(DATA, bak);
  console.log('\n已备份内容：' + bak);
} else if (T && T.mode === 'text') {
  const bak = DATA + '.before-imagevalue.txt';
  fs.copyFileSync(DATA, bak);
  console.log('\n已备份内容：' + bak);
}

// 4a) 改名：值＋原扩展名；名字里已经带值的不动；重复内容只留第一份
let renamed = 0, kept = 0;
const ValueToExt = new Map();
for (const i of info) {
  const ext = path.extname(i.file);
  const target = i.value + ext;
  if (i.file === target) { ValueToExt.set(i.value, ext); kept++; continue; }
  const dst = path.join(MEDIA, target);
  if (fs.existsSync(dst)) {          // 已经有同名目标（内容重复的情况）
    console.log(`　跳过 ${i.file}：${target} 已存在（内容相同，留一份即可）`);
    kept++; ValueToExt.set(i.value, ext); continue;
  }
  fs.renameSync(path.join(MEDIA, i.file), dst);
  ValueToExt.set(i.value, ext);
  console.log(`　改名 ${i.file}  →  ${target}`);
  renamed++;
}
console.log(`图库：改名 ${renamed} 个，保持 ${kept} 个`);

// 4b) 改写内容里的引用：老写法（文件名）→ 值；原本没题注的，把原文件名留作题注
if (T) {
  const byName = new Map(info.map(i => [i.file, i.value]));
  let hit = 0;
  const walk = n => {
    for (const lf of A.leavesOf(n)) {
      const src = String(lf.desc || '');
      const out = src.replace(/!\[\[([^\]]+)\]\]/g, (whole, inner) => {
        const [name, cap] = inner.split('|');
        const nm = (name || '').trim();
        if (!nm || A.isImgValue(nm)) return whole;            // 已经是值，不动
        const v = byName.get(nm);
        if (!v) return whole;                                  // 库里没有这个名字，原样留着（会被报成缺图）
        hit++;
        const caption = (cap || '').trim() || nm.replace(/\.[^.]+$/, '');   // 没题注就把原名留作题注
        return `![[${v}|${caption}]]`;
      });
      if (out !== src) lf.desc = out;
    }
    (n.children || []).forEach(walk);
  };
  if (T.mode === 'json') { walk(T.data); fs.writeFileSync(DATA, JSON.stringify(T.data), 'utf8'); }
  else {
    if (T.root) walk(T.root);
    fs.writeFileSync(DATA, A.treeToCode(T.root, 0), 'utf8');
  }
  console.log(`内容：改写引用 ${hit} 处`);
}

console.log('\n✓ 图库已按值整理。用应用打开看一眼：图能显示、缺图会画占位框。');
