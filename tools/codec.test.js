// 树 ⇄ 文本代码 编解码自测
// 用法：cd /home/elu/test/doc-tool/daosheng-tree && node tools/codec.test.js
// 特点：直接抽取 index.html 里的真实实现来测（测的就是页面里跑的那份代码），不依赖浏览器。
const fs = require('fs'), path = require('path'), assert = require('assert');

const here = __dirname;
const HTML = path.join(here, '..', 'index.html');
const DATA = process.env.DATA || '/mnt/c/ArborInversa/data.json';
const src = fs.readFileSync(HTML, 'utf8');

function between(a, b) {
  const i = src.indexOf(a), j = src.indexOf(b);
  assert(i >= 0 && j > i, 'index.html 里找不到标记：' + a);
  return src.slice(i, j + b.length);
}
const leavesOfSrc = src.match(/function leavesOf\(n\)\{[\s\S]*?\n\}/)[0];
const codecSrc = between('// ==== 树 ⇄ 文本代码 BEGIN', '// ==== 树 ⇄ 文本代码 END ====');
const api = new Function(leavesOfSrc + '\n' + codecSrc +
  '\nreturn {leavesOf,treeToCode,codeToTree,codeIndentOf,codeStatementOf,codeStripIndent};')();
const { leavesOf, treeToCode, codeToTree, codeIndentOf, codeStatementOf } = api;

// ---------- 规范化（编解码的既定边界：叶内容的尾部空行／行尾空格不入码）----------
const canonDesc = s => String(s == null ? '' : s).replace(/\r\n?/g, '\n').split('\n')
  .map(l => (l.trim() ? l.replace(/[ \t]+$/, '') : ''))
  .join('\n').replace(/\n+$/, '');
function canonProps(n) {
  const p = n.props;
  if (!p || typeof p !== 'object' || Array.isArray(p) || !Object.keys(p).length) return null;
  const o = {};
  Object.keys(p).forEach(k => {                       // 值统一成字符串或字符串数组
    const v = p[k];
    o[k] = Array.isArray(v) ? v.map(String) : String(v == null ? '' : v);
  });
  return o;
}
function canon(n) {
  const o = {
    name: n.name,
    leaves: leavesOf(n).map(l => ({ name: l.name || '叶', desc: canonDesc(l.desc) })),
    children: (n.children || []).map(canon)
  };
  const cp = canonProps(n);
  if (cp) o.props = cp;                               // 无属性时不带 props 键
  return o;
}
function walk(n, f, d) { f(n, d || 0); (n.children || []).forEach(c => walk(c, f, (d || 0) + 1)); }
function find(n, name) { let hit = null; walk(n, x => { if (!hit && x.name === name) hit = x; }); return hit; }
function stats(n) { let b = 0, l = 0; walk(n, x => { b++; l += leavesOf(x).length; }); return { branches: b, leaves: l }; }

let pass = 0, fail = 0;
function ok(title, fn) {
  try { fn(); console.log('  ✓ ' + title); pass++; }
  catch (e) { console.log('  ✗ ' + title + '\n      ' + (e && e.message)); fail++; }
}

// 这套自测是拿一份**真实内容数据**当夹具的；本仓库只放框架、不含内容，
// 所以没有数据文件时给出清楚提示并跳过（换台机器跑也不会崩一堆堆栈）
if (!fs.existsSync(DATA)) {
  console.log(`· 这套自测需要一份内容数据才能跑（默认找 ${DATA}）。`);
  console.log('  本仓库只放框架、不含任何内容 —— 指定一份再跑，例如：');
  console.log('    DATA=/你的/路径/data.json node tools/codec.test.js');
  console.log('  本次：跳过（0 项）');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const st = stats(data);
console.log(`数据：${DATA}\n     枝 ${st.branches} | 叶 ${st.leaves}\n`);

console.log('一、整棵树往返');
ok('treeToCode → codeToTree 结构与内容一致（当前数据全树）', () => {
  const code = treeToCode(data);
  const back = codeToTree(code);
  assert.strictEqual(back.title, null, '根不应产生标题行');
  assert.strictEqual(back.children.length, 1);
  assert.deepStrictEqual(canon(back.children[0]), canon(data));
});
ok('精确比对：除规范化差异外没有别的改动', () => {
  const back = codeToTree(treeToCode(data));
  const diffs = [];
  (function cmp(a, b, p) {
    if (a.name !== b.name) diffs.push(p + ' 枝名不同');
    if (JSON.stringify(canonProps(a)) !== JSON.stringify(canonProps(b))) diffs.push(p + ' 属性不同');
    const la = leavesOf(a), lb = leavesOf(b);
    if (la.length !== lb.length) diffs.push(p + ' 叶数不同');
    la.forEach((x, i) => { if (x.name !== (lb[i] || {}).name) diffs.push(p + '/' + x.name + ' 叶名不同'); });
    la.forEach((x, i) => { if (x.desc !== (lb[i] || {}).desc) diffs.push(p + '/' + x.name + ' 内容规范化'); });
    (a.children || []).forEach((c, i) => cmp(c, (b.children || [])[i], p + '/' + c.name));
  })(data, back.children[0], '');
  assert.ok(diffs.length <= 3, '差异过多：' + diffs.length + ' 处\n      ' + diffs.slice(0, 5).join('\n      '));
  if (diffs.length) console.log('      （可接受的规范化差异 ' + diffs.length + ' 处：' + diffs.join('；') + '）');
});

console.log('二、任意一枝都是一棵可独立转写的树');
['中国美术史', '两宋', '元代', '绘画', '元四家'].forEach(name => {
  ok('子树「' + name + '」往返一致', () => {
    const n = find(data, name);
    assert.ok(n, '数据里找不到该枝');
    const code = treeToCode(n);
    const back = codeToTree(code);
    assert.strictEqual(back.children.length, 1);
    assert.deepStrictEqual(canon(back.children[0]), canon(n));
  });
});
ok('把子树代码种进另一枝：解析结果可直接作为新下枝', () => {
  const n = find(data, '元四家');
  const parsed = codeToTree(treeToCode(n));
  const branch = parsed.children[0];
  assert.strictEqual(branch.name, '元四家');
  assert.deepStrictEqual(branch.children.map(c => c.name), ['黄公望', '吴镇', '倪瓒', '王蒙']);
});

console.log('三、边界情况');
ok('空树（只有名字、一片空叶）', () => {
  const n = { name: '空枝', leaves: [{ name: '概述', desc: '' }], children: [] };
  assert.deepStrictEqual(canon(codeToTree(treeToCode(n)).children[0]), canon(n));
});
ok('内容里出现关键字行（枝 X／叶 X）不会被误当结构', () => {
  const n = { name: 'A', leaves: [{ name: '概述', desc: '枝 假的\n叶 假的\n真的内容' }], children: [] };
  const back = codeToTree(treeToCode(n)).children[0];
  assert.strictEqual(back.children.length, 0, '不该解析出下枝');
  assert.strictEqual(leavesOf(back)[0].desc, '枝 假的\n叶 假的\n真的内容');
});
ok('多行内容：中间空行保留、尾部空行按规范裁掉', () => {
  const n = { name: 'A', leaves: [{ name: '概述', desc: '第一段\n\n第二段\n\n\n' }], children: [] };
  const back = codeToTree(treeToCode(n)).children[0];
  assert.strictEqual(leavesOf(back)[0].desc, '第一段\n\n第二段');
});
ok('缩进可用 Tab 或全角空格', () => {
  const code = '枝 甲\n\t叶 形势\n\t\t甲的内容\n枝 乙\n\u3000叶 概述\n\u3000\u3000乙的内容\n';
  const t = codeToTree(code);
  assert.deepStrictEqual(t.children.map(c => c.name), ['甲', '乙']);
  assert.strictEqual(leavesOf(t.children[0])[0].desc, '甲的内容');
  assert.strictEqual(leavesOf(t.children[1])[0].desc, '乙的内容');
});
ok('缩进深度决定层级（同深即同级，更深即下枝）', () => {
  const code = '枝 甲\n  叶 概述\n    甲\n  枝 乙\n    叶 概述\n      乙\n';
  const t = codeToTree(code);
  assert.deepStrictEqual(t.children.map(c => c.name), ['甲']);
  assert.deepStrictEqual(t.children[0].children.map(c => c.name), ['乙']);
});
ok('缩进错误／未知关键字会报出错行号', () => {
  assert.throws(() => codeToTree('枝 甲\n  叶 形势\n没缩进的一行\n'), /第 3 行/);
  assert.throws(() => codeToTree('枝 甲\n  随便写点什么\n'), /第 2 行/);
});
ok('只有叶的代码（用来给当前枝加叶）', () => {
  const t = codeToTree('叶 形势\n  内容一\n叶 变迁\n  内容二\n');
  assert.strictEqual(t.children.length, 0);
  assert.deepStrictEqual(t.leaves.map(l => l.name), ['形势', '变迁']);
  assert.strictEqual(t.leaves[1].desc, '内容二');
});
ok('首行「树 名称」被识别为标题', () => {
  const t = codeToTree('树 逆生树\n  叶 概述\n    说明\n  枝 中国美术史\n');
  assert.strictEqual(t.title, '逆生树');
  assert.strictEqual(t.leaves.length, 1);
  assert.deepStrictEqual(t.children.map(c => c.name), ['中国美术史']);
});
ok('枝名／叶名里可以有空格和标点', () => {
  const n = { name: '李成 与 范宽', leaves: [{ name: '概述 · 甲', desc: 'x' }], children: [] };
  const back = codeToTree(treeToCode(n)).children[0];
  assert.strictEqual(back.name, '李成 与 范宽');
  assert.strictEqual(leavesOf(back)[0].name, '概述 · 甲');
});
ok('五层嵌套往返', () => {
  const n = { name: 'L1', leaves: [{ name: '概述', desc: 'd1' }], children: [{ name: 'L2', leaves: [], children: [{ name: 'L3', leaves: [], children: [{ name: 'L4', leaves: [], children: [{ name: 'L5', leaves: [{ name: '概述', desc: 'd5' }], children: [] }] }] }] }] };
  assert.deepStrictEqual(canon(codeToTree(treeToCode(n)).children[0]), canon(n));
});
ok('带 BOM 的文本（记事本另存 UTF-8）也能解析', () => {
  const t = codeToTree('\uFEFF枝 甲\n  叶 概述\n    内容\n');
  assert.deepStrictEqual(t.children.map(c => c.name), ['甲']);
  assert.strictEqual(leavesOf(t.children[0])[0].desc, '内容');
});
ok('空代码 / 纯空白不报结构错误（由界面提示为空）', () => {
  const t = codeToTree('\n   \n\n');
  assert.strictEqual(t.children.length, 0);
  assert.strictEqual(t.leaves.length, 0);
});

console.log('四、属性（属性 键: 值）');
ok('枝的属性往返：单值 + 多值（数组）', () => {
  const n = { name: '南宋', props: { 类型: '时代', 标签: ['绘画', '书法'], 别名: '赵宋南渡' },
              leaves: [{ name: '形势', desc: '偏安江南' }], children: [] };
  assert.deepStrictEqual(canon(codeToTree(treeToCode(n)).children[0]), canon(n));
});
ok('属性行写在枝行下方、与叶行同级', () => {
  const code = '枝 南宋\n  属性 类型: 时代\n  叶 形势\n    偏安江南\n';
  const t = codeToTree(code).children[0];
  assert.deepStrictEqual(t.props, { 类型: '时代' });
  assert.strictEqual(leavesOf(t)[0].desc, '偏安江南');
});
ok('多值用逗号分隔（半角/全角均可）→ 数组', () => {
  assert.deepStrictEqual(codeToTree('枝 A\n  属性 标签: 山水, 花鸟\n').children[0].props, { 标签: ['山水', '花鸟'] });
  assert.deepStrictEqual(codeToTree('枝 A\n  属性 标签: 山水，花鸟\n').children[0].props, { 标签: ['山水', '花鸟'] });
});
ok('全角冒号「：」也能写', () => {
  assert.deepStrictEqual(codeToTree('枝 A\n  属性 年代：南宋\n').children[0].props, { 年代: '南宋' });
});
ok('树标题旁也能挂属性（根属性）', () => {
  const t = codeToTree('树 逆生树\n  属性 版本: 1.0\n  枝 中国美术史\n');
  assert.strictEqual(t.title, '逆生树');
  assert.deepStrictEqual(t.props, { 版本: '1.0' });
});
ok('属性写在叶内容里不会被当成结构', () => {
  const n = { name: 'A', leaves: [{ name: '概述', desc: '正文\n属性 假: 值' }], children: [] };
  const back = codeToTree(treeToCode(n)).children[0];
  assert.strictEqual(back.props, undefined, '不该解析出属性');
  assert.deepStrictEqual(canon(back), canon(n));
});
ok('没有属性的枝不会生成属性行', () => {
  const n = { name: 'A', leaves: [{ name: '概述', desc: 'x' }], children: [] };
  assert.ok(!/属性/.test(treeToCode(n)), '代码里不该出现「属性」');
});
ok('属性行没写成「键: 值」会报出错行号', () => {
  assert.throws(() => codeToTree('枝 A\n  属性 只有键没有值\n'), /第 2 行/);
});

console.log('\n结果：通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
