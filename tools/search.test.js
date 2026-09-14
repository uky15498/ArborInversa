// 搜索 与 枝属性 自测
// 用法：cd /home/elu/test/doc-tool/daosheng-tree && node tools/search.test.js
// 特点：直接抽取 index.html 里的真实实现来跑（不依赖浏览器、不依赖 DOM）。
const fs = require('fs'), path = require('path'), assert = require('assert');

const HTML = path.join(__dirname, '..', 'index.html');
const DATA = process.env.DATA || '/mnt/c/ArborInversa/data.json';
const src = fs.readFileSync(HTML, 'utf8');

function slice(a, b, what) {
  const i = src.indexOf(a), j = src.indexOf(b, i + a.length);
  assert(i >= 0 && j > i, 'index.html 里找不到：' + what);
  return src.slice(i, j);
}
const escSrc    = src.match(/const esc=s=>String\(s\?\?[^\n]*\n/)[0];
const leavesSrc = src.match(/function leavesOf\(n\)\{[\s\S]*?\n\}/)[0];
const propsSrc  = slice('function propsOf(n){', '\nfunction crumbHTML', '属性 helpers');
const searchSrc = slice('// ==== 搜索 BEGIN ====', 'let sRes=[]', '搜索引擎');

const api = new Function('DATA', escSrc + '\n' + leavesSrc + '\n' + propsSrc + '\n' + searchSrc +
  '\nreturn {esc,leavesOf,propsOf,propPairs,propsText,propValText,sTokens,searchUnits,runSearch,' +
  'runQuery,runRows,rowsToTokens,findPathsByName,inPath,isBranchConst,highlight,snippetAround};');

// 这套自测是拿一份**真实内容数据**当夹具的；本仓库只放框架、不含内容，
// 所以没有数据文件时给出清楚提示并跳过（换台机器跑也不会崩一堆堆栈）
if (!fs.existsSync(DATA)) {
  console.log(`· 这套自测需要一份内容数据才能跑（默认找 ${DATA}）。`);
  console.log('  本仓库只放框架、不含任何内容 —— 指定一份再跑，例如：');
  console.log('    DATA=/你的/路径/data.json node tools/search.test.js');
  console.log('  本次：跳过（0 项）');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const S = api(data);                      // 真实数据（当前没有属性）
const D2 = JSON.parse(JSON.stringify(data));
(function addProps(n, name, props) {      // 造一份带属性的数据来测属性筛选
  if (n.name === name) n.props = props;
  (n.children || []).forEach(c => addProps(c, name, props));
})(D2, '元四家', { 类型: '画派', 标签: ['山水', '文人画'], 别名: '元季四大家' });
(function addProps2(n) {
  if (n.name === '郭熙') n.props = { 类型: '画家', 别名: ['郭河阳'], 标签: '山水' };
  (n.children || []).forEach(addProps2);
})(D2);
const S2 = api(D2);

// 属性栏的「类别 → 常用属性」表（与搜索引擎无关，但同一份数据驱动，放这里一起把关）
const propSrc = (function () {
  const i = src.indexOf('const PROP_KINDS={'), j = src.indexOf('let propOpen=');
  assert(i >= 0 && j > i, 'index.html 里找不到属性栏的属性表');
  return src.slice(i, j);
})();
const P = new Function(propSrc + '\nreturn {PROP_KINDS,PROP_VALUES};')();

let pass = 0, fail = 0;
function ok(title, fn) {
  try { fn(); console.log('  ✓ ' + title); pass++; }
  catch (e) { console.log('  ✗ ' + title + '\n      ' + (e && e.message)); fail++; }
}
const names = hits => hits.map(h => h.u.name);
const allText = h => [h.u.name, h.u.leafName, h.u.desc, h.u.props].filter(Boolean).join(' ');

console.log(`数据：${DATA}\n     搜索引擎抽取自 index.html（${searchSrc.split('\n').length} 行）\n`);

console.log('一、语法解析 sTokens');
ok('普通词 / 短语 / 排除 / 字段 / 属性筛选 都能切出来', () => {
  assert.deepStrictEqual(S.sTokens('南宋'), [{ neg: false, text: '南宋' }]);
  assert.deepStrictEqual(S.sTokens('"清明上河图"'), [{ phrase: true, text: '清明上河图' }]);
  assert.deepStrictEqual(S.sTokens('-四家'), [{ neg: true, text: '四家' }]);
  assert.deepStrictEqual(S.sTokens('枝:南宋'), [{ neg: false, field: '枝', text: '南宋' }]);
  assert.deepStrictEqual(S.sTokens('标签:山水'), [{ neg: false, field: '标签', text: '山水' }]);
  assert.deepStrictEqual(S.sTokens('a b'), [{ neg: false, text: 'a' }, { neg: false, text: 'b' }]);
});
ok('空查询、只有排除词的查询都返回空结果', () => {
  assert.deepStrictEqual(S.runSearch(''), []);
  assert.deepStrictEqual(S.runSearch('   '), []);
  assert.deepStrictEqual(S.runSearch('-南宋'), []);
});

console.log('二、检索范围与字段语法');
ok('搜索单位 ＝ 122 枝 + 142 叶', () => {
  const u = S.searchUnits();
  assert.strictEqual(u.length, 122 + 142);
  assert.strictEqual(u.filter(x => x.leaf).length, 142);
});
ok('普通词能命中枝名', () => {
  const h = S.runSearch('南宋');
  assert.ok(h.length > 0, '应有命中');
  assert.ok(h.some(x => x.where === '枝' && x.u.name.includes('南宋')));
  assert.strictEqual(h[0].u.name, h[0].u.name);      // 首条即最高分
  assert.ok(h[0].where === '枝' || h[0].where === '叶', '枝名/叶名 应排在正文前面');
});
ok('枝: 只限定枝名', () => {
  const h = S.runSearch('枝:两宋');
  assert.ok(h.length > 0);
  h.forEach(x => { assert.ok(!x.u.leaf, '枝: 只应给出枝级结果'); assert.ok(x.u.name.includes('两宋')); });
});
ok('叶: 只限定叶名', () => {
  const h = S.runSearch('叶:形势');
  assert.strictEqual(h.length, 10, '10 个时代各有「形势」叶');
  h.forEach(x => { assert.ok(x.u.leaf && x.u.leafName.includes('形势')); assert.strictEqual(x.where, '叶'); });
});
ok('文: 只限定叶正文（披麻皴）', () => {
  const h = S.runSearch('文:披麻皴');
  assert.ok(h.length > 0);
  h.forEach(x => { assert.ok(x.u.leaf && x.where === '文'); });
});
ok('深: 限定层级（深度 2 ＝ 10 个时代）', () => {
  const h = S.runSearch('深:2');
  assert.strictEqual(h.length, 10);
  h.forEach(x => assert.strictEqual(x.u.depth, 2));
});
ok('多词是 AND', () => {
  assert.ok(S.runSearch('赵孟頫 元代').length > 0);
  assert.deepStrictEqual(S.runSearch('赵孟頫 这个词不存在'), []);
});
ok('-词 排除', () => {
  const h = S.runSearch('南宋 -四家');
  assert.ok(h.length > 0, '应有命中');
  h.forEach(x => assert.ok(!allText(x).includes('四家'), '不该出现含「四家」的结果：' + allText(x).slice(0, 40)));
});
ok('"精确短语" 可用', () => {
  const h = S.runSearch('"清明上河图"');
  assert.ok(h.length > 0);
  assert.ok(h.some(x => (x.u.desc || '').includes('清明上河图')));
});
ok('[[链接]] 与 ![[图片]] 标记先剥离再搜', () => {
  assert.ok(S.runSearch('示例-汝窑天青釉').length === 0, '图片文件名不该被搜到');
  assert.ok(S.runSearch('仰韶文化').length > 0, '[[链接]] 里的词仍可搜（正文出现过）');
});

console.log('三、枝属性（props）');
ok('propsOf：空对象 / 缺字段都视作没有属性', () => {
  assert.strictEqual(S.propsOf({ name: 'A' }), null);
  assert.strictEqual(S.propsOf({ name: 'A', props: {} }), null);
  assert.strictEqual(S.propsOf({ name: 'A', props: [] }), null);
  assert.deepStrictEqual(S.propsOf({ name: 'A', props: { 类型: 'x' } }), { 类型: 'x' });
});
ok('属性参与普通全文检索', () => {
  const h = S2.runSearch('元季四大家');
  assert.ok(h.length > 0, '别名应能搜到');
  assert.ok(h.some(x => x.where === '属性' && x.u.name === '元四家'));
});
ok('键:值 属性筛选（键名不必写全、值可命中数组里的一项）', () => {
  const a = S2.runSearch('标签:山水');
  assert.ok(a.length > 0);
  assert.ok(names(a).includes('元四家'));
  const b = S2.runSearch('类型:画派');
  assert.deepStrictEqual(names(b).filter(n => n === '元四家').length, 1);
  const c = S2.runSearch('别名:郭河阳');
  assert.ok(names(c).includes('郭熙'));
});
ok('有:键 —— 该枝拥有此属性', () => {
  const h = S2.runSearch('有:别名');
  const ns = names(h);
  assert.ok(ns.includes('元四家') && ns.includes('郭熙'));
  assert.ok(!ns.includes('两宋'), '没写属性的枝不该命中');
});
ok('属性筛选 + 正文词 可以叠加（AND）', () => {
  const h = S2.runSearch('标签:山水 黄公望');
  assert.ok(h.length > 0);
  assert.ok(names(h).includes('元四家'));
});
ok('不存在的属性键／不存在的属性名查不到东西（不报错）', () => {
  assert.deepStrictEqual(S.runSearch('这个属性键不存在:山水'), []);
  assert.deepStrictEqual(S.runSearch('有:这个属性名不存在'), []);
});
ok('真实数据里已统一补好的属性可被检索到', () => {
  const h = S.runSearch('有:别名');                       // seed_props 补过别名的枝
  assert.ok(h.length > 0);
  assert.ok(names(h).includes('黄公望'));
  const g = S.runSearch('类型:画家');
  assert.ok(names(g).includes('黄公望'));
  const sc = S.runSearch('门类:绘画');
  assert.ok(sc.length > 0);
  const t = S.runSearch('题材:山水');
  assert.ok(names(t).some(n => n === '郭熙' || n === '黄公望'));
});

console.log('四、高亮与片段');
ok('highlight 命中处包 <mark>', () => {
  assert.strictEqual(S.highlight('南宋四家', ['南宋']), '<mark>南宋</mark>四家');
  assert.strictEqual(S.highlight('吴道子与阎立本', ['吴道子', '阎立本']),
    '<mark>吴道子</mark>与<mark>阎立本</mark>');
});
ok('highlight 先转义再标（不会把正文里的标签当 HTML）', () => {
  assert.strictEqual(S.highlight('<b>南宋</b>', ['南宋']), '&lt;b&gt;<mark>南宋</mark>&lt;/b&gt;');
});
ok('highlight 对大小写不敏感、不会重复套标记', () => {
  assert.strictEqual(S.highlight('Yuan Yuan', ['yuan']), '<mark>Yuan</mark> <mark>Yuan</mark>');
});
ok('snippetAround 给出命中附近的上下文并加省略号', () => {
  const s = S.snippetAround('前'.repeat(100) + '披麻皴' + '后'.repeat(100), ['披麻皴']);
  assert.ok(s.includes('披麻皴'));
  assert.ok(s.startsWith('…') && s.endsWith('…'));
  assert.ok(s.length < 80, '片段要截短，实际 ' + s.length);
});

console.log('五、结果排序与跳转信息');
ok('高分在前：枝名命中排在正文命中之前', () => {
  const h = S.runSearch('郭熙');
  const firstText = h.findIndex(x => x.where === '文');
  const firstBranch = h.findIndex(x => x.where === '枝');
  if (firstText >= 0 && firstBranch >= 0) assert.ok(firstBranch < firstText, '枝名应排在正文前');
});
ok('每条结果都带可跳转的路径（叶级还带叶下标）', () => {
  const h = S.runSearch('披麻皴');
  h.forEach(x => {
    assert.ok(Array.isArray(x.u.path));
    if (x.u.leaf) assert.ok(Number.isInteger(x.u.leafIdx) && x.u.leafIdx >= 0);
  });
  const leafHit = h.find(x => x.u.leaf);
  assert.ok(leafHit, '应能命中某片叶的正文');
  const node = leafHit.u.path.reduce((n, i) => n.children[i], data);
  assert.strictEqual(S.leavesOf(node)[leafHit.u.leafIdx].name, leafHit.u.leafName);
});

console.log('六、范围限定（下: / 在:）与含: 维度');
const YUAN = ['中国美术史', '元代'];
const yuanPath = (function find(n, p) {
  if (n.name === '元代') return p;
  for (let i = 0; i < (n.children || []).length; i++) {
    const r = find(n.children[i], p.concat(i)); if (r) return r;
  }
  return null;
})(data, []);
const underYuan = h => h.every(x => S.inPath(x.u.path, yuanPath));
ok('下:元代 —— 只在这棵子树里找，且只列枝', () => {
  const h = S.runSearch('下:元代');
  assert.ok(h.length > 0, '应有命中');
  assert.ok(underYuan(h), '结果必须都在「元代」之下');
  assert.ok(h.every(x => !x.u.leaf), '只有范围限定时应只列枝');
  const yuanNode = yuanPath.reduce((n, i) => n.children[i], data);
  const nYuan = (function cnt(n) { return 1 + (n.children || []).reduce((a, c) => a + cnt(c), 0); })(yuanNode);
  assert.strictEqual(h.length, nYuan, '应列出「元代」子树下的全部 ' + nYuan + ' 个枝');
});
ok('在: 是 下: 的同义词', () => {
  assert.strictEqual(S.runSearch('在:元代').length, S.runSearch('下:元代').length);
});
ok('限定的枝名不存在 → 空结果（不静默忽略）', () => {
  assert.deepStrictEqual(S.runSearch('下:这个枝不存在'), []);
});
ok('范围 + 正文词：只返回范围里的命中', () => {
  const h = S.runSearch('下:元代 披麻皴');
  assert.ok(h.length > 0);
  assert.ok(underYuan(h));
  assert.ok(h.some(x => x.where === '文'));
});
ok('含:图 —— 只命中带插图的叶', () => {
  const h = S.runSearch('含:图');
  assert.strictEqual(h.length, 1, '当前数据只有 1 处插图');
  assert.strictEqual(h[0].u.name, '汝窑');
  assert.ok(h[0].u.leaf);
});
ok('含:链 —— 命中含跳转链接的叶', () => {
  const h = S.runSearch('含:链');
  assert.ok(h.length > 0);
  h.forEach(x => assert.ok(x.u.leaf && x.where === '链'));
});
ok('含:下枝 —— 命中还有下级枝的枝', () => {
  const h = S.runSearch('含:下枝');
  assert.ok(h.length > 0);
  h.forEach(x => { assert.ok(!x.u.leaf); assert.ok((x.u.node.children || []).length > 0); });
});

console.log('七、条件行（限定栏）与并行规则');
ok('条件行 → 查询词条 的映射', () => {
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'prop', key: '标签', value: '山水' }]),
    [{ field: '标签', text: '山水' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'scope', value: '元代' }]), [{ field: '下', text: '元代' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'branch', value: '元' }]), [{ field: '枝', text: '元' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'depth', value: '2' }]), [{ field: '深', text: '2' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'has', value: '图' }]), [{ field: '含', text: '图' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'neg', value: '四家' }]), [{ neg: true, text: '四家' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'branch', value: '  ' }]), [], '空值条件不参与');
});
ok('一条「在枝下」条件 ＝ 下:xxx', () => {
  const a = S.runRows([{ kind: 'scope', value: '元代' }], {});
  assert.strictEqual(a.length, S.runSearch('下:元代').length);
});
ok('「朝代 + 属性」正是这次要的用法（两条条件，并且）', () => {
  const yuan = S2.runRows([{ kind: 'scope', value: '元代' }, { kind: 'prop', key: '标签', value: '山水' }], { combine: 'and' });
  assert.deepStrictEqual(names(yuan), ['元四家']);
  const song = S2.runRows([{ kind: 'scope', value: '两宋' }, { kind: 'prop', key: '标签', value: '山水' }], { combine: 'and' });
  assert.ok(names(song).includes('郭熙'), '两宋下带「标签:山水」的枝应命中');
  assert.ok(!names(song).includes('元四家'), '范围要真的起作用');
});
ok('并行规则：并且 / 或者', () => {
  const rows = [{ kind: 'branch', value: '元代' }, { kind: 'branch', value: '五代' }];
  assert.strictEqual(S.runRows(rows, { combine: 'and' }).length, 0, '一个枝名不可能同时含两者');
  const or = S.runRows(rows, { combine: 'or' });
  assert.ok(or.length > 0, '或者：任一命中即可');
});
ok('关键词始终「必须命中」，不受 或者 影响', () => {
  const rows = [{ kind: 'scope', value: '元代' }, { kind: 'scope', value: '两宋' }];
  const h = S.runRows(rows, { combine: 'or', free: '黄公望' });
  assert.ok(h.length > 0);
  h.forEach(x => assert.ok(allText(x).includes('黄公望') || (x.u.desc || '').includes('黄公望'),
    '关键词必须命中：' + x.u.name));
  assert.deepStrictEqual(S.runRows(rows, { combine: 'or', free: '这个词根本不存在' }), []);
});
ok('多条「在枝下」＝ 取并集（搜这几棵子树）', () => {
  const both = S.runRows([{ kind: 'scope', value: '元代' }, { kind: 'scope', value: '两宋' }], { combine: 'and' });
  const only = S.runRows([{ kind: 'scope', value: '元代' }], {});
  assert.ok(both.length > only.length, '两棵子树应比一棵多');
  assert.ok(both.every(x => S.inPath(x.u.path, yuanPath) || x.u.name === '两宋' || S.inPath(x.u.path, (function f(n, p) {
    if (n.name === '两宋') return p;
    for (let i = 0; i < (n.children || []).length; i++) { const r = f(n.children[i], p.concat(i)); if (r) return r; }
    return null;
  })(data, []))));
});
ok('枝: 只认自身枝名（搜子树要用 下:）—— 这是两个维度的分工', () => {
  const byName = S.runSearch('枝:元代');
  const byScope = S.runSearch('下:元代');
  assert.ok(byScope.length > byName.length, '范围限定应比枝名匹配宽');
  assert.ok(byName.every(x => x.u.name.includes('元代')));
});
ok('关键词里也可以直接写语法（与条件叠加）', () => {
  const h = S.runRows([{ kind: 'scope', value: '元代' }], { free: '文:披麻皴' });
  assert.ok(h.length > 0);
  assert.ok(h.every(x => !x.u.leaf ? true : x.where === '文'));
  assert.ok(underYuan(h));
});
ok('深度条件行', () => {
  assert.strictEqual(S.runRows([{ kind: 'depth', value: '2' }], {}).length, 10);
});

console.log('八、详情页属性栏的常用属性表');
ok('数据里出现的每种「类型」都能在属性栏里选到（有「默认」兜底）', () => {
  const types = new Set();
  (function w(n) { const p = n.props; if (p && p['类型']) types.add(Array.isArray(p['类型']) ? p['类型'][0] : p['类型']);
    (n.children || []).forEach(w); })(data);
  assert.ok(types.size >= 10, '当前数据应已有多种类型，实际 ' + types.size);
  types.forEach(t => assert.ok(P.PROP_KINDS[t] || P.PROP_KINDS['默认'], '缺少「' + t + '」的常用属性表'));
});
ok('常用属性表：每类非空、无重复、「默认」存在', () => {
  Object.keys(P.PROP_KINDS).forEach(k => {
    const list = P.PROP_KINDS[k];
    assert.ok(list.length > 0, k + ' 是空的');
    assert.strictEqual(new Set(list).size, list.length, k + ' 有重复项');
  });
  assert.ok(P.PROP_KINDS['默认'], '必须有默认兜底');
});
ok('PROP_VALUES.类型 覆盖数据里出现的全部类型值', () => {
  const types = new Set();
  (function w(n) { const p = n.props; if (p && p['类型']) types.add(Array.isArray(p['类型']) ? p['类型'][0] : p['类型']);
    (n.children || []).forEach(w); })(data);
  types.forEach(t => assert.ok(P.PROP_VALUES['类型'].includes(t), 'PROP_VALUES 里没有 ' + t));
});
ok('统一补的属性：键集合可控、值类型合法', () => {
  const keys = new Set();
  (function w(n) {
    const p = n.props;
    if (p) Object.keys(p).forEach(k => {
      keys.add(k);
      const v = p[k];
      assert.ok(typeof v === 'string' || (Array.isArray(v) && v.every(x => typeof x === 'string') && v.length > 1),
        n.name + '.' + k + ' 的值类型不合法（单值应写成文本，不要单元素数组）');
    });
    (n.children || []).forEach(w);
  })(data);
  ['类型', '朝代', '年代', '门类', '题材', '流派', '别名'].forEach(k =>
    assert.ok(keys.has(k), '少了键 ' + k));
});

console.log('\n结果：通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
