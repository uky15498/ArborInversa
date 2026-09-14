// 按统一规则给全部枝补属性（props）
// 用法：
//   node tools/seed_props.js            # 空跑：只打印将要写入的属性，不落盘
//   node tools/seed_props.js --write    # 真写（会先自动备份 data.before-props.json）
//   环境变量 DATA=<路径> 可换数据文件
//
// 统一规则（2026-09-14 用户确立「统一补」）：
//   类型   结构位置 + 名称 + 正文关键词判定：框架/分支树/时代/分类/画家/书法家/书画家/
//          流派/窑口/遗址/画论/文物/文化/现象
//   朝代   该枝所属时代（取第 2 层祖先；「史前与三代」细分为 新石器时代／商周）
//   年代   只给时代枝写（历史年代区间）
//   门类   路径上的 绘画／书法／文物
//   题材   路径上的 人物／山水／花鸟／道释／肖像／风俗／历史
//   流派   路径上的群体枝（元四家／南宋四家／李成传派…）
//   别名   画家／书法家／书画家：从正文里抽 字、号、人称/世称/自号『…』
// 已存在的属性键一律保留（脚本只补它负责的键）。
const fs = require('fs'), path = require('path');

const DATA = process.env.DATA || '/mnt/c/ArborInversa/data.json';
const WRITE = process.argv.includes('--write');
const HERE = path.join(__dirname, '..');

const TYPE_BY_NAME = { '逆生树': '框架', '中国美术史': '分支树' };
const ERA_RANGE = {
  '史前与三代': '约前8000—前221', '秦汉': '前221—220', '魏晋南北朝': '220—589',
  '隋唐': '581—907', '五代': '907—960', '两宋': '960—1279', '元代': '1271—1368',
  '明': '1368—1644', '清': '1644—1912', '近现代': '1840—今'
};
const PRE_HIST = { '新石器时代彩陶': '新石器时代', '商周青铜器': '商周' };
const GROUPS = ['元四家', '南宋四家', '明四家', '四王吴恽', '扬州八怪', '李成传派', '海派', '吴门画派', '宋四家'];
const WARES = ['哥窑', '汝窑', '官窑', '钧窑', '定窑'];
const SITES = ['敦煌莫高窟', '云冈石窟', '龙门石窟'];
const THEORY = ['迁想妙得与传神论'];
const RELICS = ['司母戊鼎', '四羊方尊', '秦代兵马俑', '汉代画像石', '马王堆帛画', '唐墓壁画与三彩'];
const CULTURE = ['仰韶文化', '马家窑文化'];
const PHENOMENA = ['当代水墨'];
const PAINTER_NAMES = ['吴道子', '阎立本', '徐悲鸿', '齐白石', '黄宾虹', '潘天寿', '林风眠'];
const SECTIONS = ['绘画', '书法', '文物'];
const SUBJECTS = ['人物', '山水', '花鸟', '道释', '肖像', '风俗', '历史'];
const NAME_ALIAS = { '赵佶': ['宋徽宗'] };                       // 正文里写明的事实，正则抓不到
const SUBJECT_BY_GROUP = { '元四家': '山水', '南宋四家': '山水', '李成传派': '山水', '四王吴恽': '山水' };
const STYLE_WORDS = /山水$|画派$|一体$|富贵$/;                    // 人称『关家山水』这类是风格名，不当别名

const leavesOf = n => (Array.isArray(n.leaves) && n.leaves.length) ? n.leaves
  : (typeof n.desc === 'string' && n.desc.trim()) ? [{ name: '概述', desc: n.desc }] : [{ name: '概述', desc: '' }];
const firstText = n => (leavesOf(n)[0] || {}).desc || '';
const allText = n => leavesOf(n).map(l => l.desc || '').join('\n');

function typeOf(node, depth) {
  const name = node.name, d = firstText(node);
  if (TYPE_BY_NAME[name]) return TYPE_BY_NAME[name];
  if (depth === 2) return '时代';
  if (GROUPS.includes(name)) return '流派';
  if (WARES.includes(name)) return '窑口';
  if (SITES.includes(name)) return '遗址';
  if (THEORY.includes(name)) return '画论';
  if (RELICS.includes(name)) return '文物';
  if (CULTURE.includes(name)) return '文化';
  if (PHENOMENA.includes(name)) return '现象';
  if (SUBJECTS.includes(name)) return '题材';        // 人物／山水／花鸟… 是画科节点（哪怕它是末端）
  if (SECTIONS.includes(name)) return '门类';        // 绘画／书法／文物
  if ((node.children || []).length) return '分类';   // 还有下枝 → 是分类节点，不可能是某个人
  if (PAINTER_NAMES.includes(name)) return '画家';
  const painter = /画家|画院|待诏|画学|画圣/.test(d);
  const callig  = /书法家/.test(d);
  if (/书画家/.test(d) || (painter && callig)) return '书画家';
  if (painter) return '画家';
  if (callig) return '书法家';
  return '条目';                       // 兜底：跑完会列出来，人工确认
}

// 从正文抽字号、别称
function aliasesOf(node, type) {
  if (!['画家', '书法家', '书画家'].includes(type)) return [];
  const d = allText(node), name = node.name, out = [];
  const push = s => { s = String(s || '').replace(/[（(].*?[)）]/g, '').trim();
    if (s && s !== name && !out.includes(s)) out.push(s); };
  let m;
  const zi = /字([\u4e00-\u9fa5]{1,4})(?=[，。、；])/g;      // 字子久，
  while ((m = zi.exec(d)) !== null) push(m[1]);
  const hao = /号([\u4e00-\u9fa5、]{1,14})(?=[，。；])/g;      // 号大痴、一峰道人，
  while ((m = hao.exec(d)) !== null) m[1].split('、').forEach(push);
  const called = /(?:人称|世称|又称|自称|别号|自号|号)『([^』]{1,10})』/g;
  while ((m = called.exec(d)) !== null) if (!STYLE_WORDS.test(m[1])) push(m[1]);
  const orig = /原名([\u4e00-\u9fa5]{2,4})(?=[，。、])/g;     // 原名朱耷，
  while ((m = orig.exec(d)) !== null) push(m[1]);
  (NAME_ALIAS[name] || []).forEach(push);
  return out;
}

function build(data) {
  const log = [];
  (function walk(node, depth, pathNames) {
    const props = Object.assign({}, node.props && typeof node.props === 'object' && !Array.isArray(node.props) ? node.props : {});
    const type = typeOf(node, depth);
    const era = (depth >= 2 && pathNames.length > 2) ? pathNames[2] : null;   // 第 2 层的名字＝时代
    let dynasty = null;
    if (era) dynasty = (era === '史前与三代' && PRE_HIST[pathNames[3]]) ? PRE_HIST[pathNames[3]] : era;
    const section = pathNames.slice(3).find(x => SECTIONS.includes(x));
    const subject = pathNames.slice(3).find(x => SUBJECTS.includes(x));
    const group   = pathNames.slice(3).find(x => GROUPS.includes(x) && x !== node.name);
    const alias   = aliasesOf(node, type);

    // 门类：路径上没有时，由「类型」推（画家＝绘画、书法家＝书法、书画家＝两者）
    let sect = section;
    if (!sect) {
      if (type === '画家') sect = '绘画';
      else if (type === '书法家') sect = '书法';
      else if (type === '书画家') sect = ['绘画', '书法'];
    }
    // 题材：画派成员按该画派的题材补（元四家／南宋四家／李成传派／四王吴恽 皆山水）
    const subj = subject || (group ? SUBJECT_BY_GROUP[group] : null);
    props['类型'] = type;
    if (depth === 2 && ERA_RANGE[node.name]) props['年代'] = ERA_RANGE[node.name];
    if (dynasty) props['朝代'] = dynasty;
    if (sect) props['门类'] = sect;
    if (subj) props['题材'] = subj;
    if (group) props['流派'] = group;
    if (alias.length) props['别名'] = (alias.length > 1 ? alias : alias[0]);   // 单值即文本

    // 键序固定，便于 diff
    const order = ['类型', '朝代', '年代', '门类', '题材', '流派', '别名'];
    const sorted = {};
    order.forEach(k => { if (props[k] !== undefined) sorted[k] = props[k]; });
    Object.keys(props).forEach(k => { if (sorted[k] === undefined) sorted[k] = props[k]; });

    node.props = sorted;
    log.push({ depth: depth, name: node.name, type: type, props: sorted });
    (node.children || []).forEach(c => walk(c, depth + 1, pathNames.concat(c.name)));
  })(data, 0, [data.name]);
  return log;
}

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const log = build(data);

const byType = {};
log.forEach(r => { byType[r.type] = (byType[r.type] || 0) + 1; });
console.log('枝 ' + log.length + ' 个，类型分布：' +
  Object.keys(byType).sort((a, b) => byType[b] - byType[a]).map(k => k + ' ' + byType[k]).join('｜'));
const fallback = log.filter(r => r.type === '条目');
if (fallback.length) console.log('⚠ 兜底为「条目」的枝（需人工确认）：' + fallback.map(r => r.name).join('、'));

console.log('\n逐枝属性（抽 25 个看）：');
const show = log.filter((r, i) => i < 8 || (i % 6 === 0)).slice(0, 25);
show.forEach(r => console.log('  ' + '  '.repeat(r.depth) + r.name + '  →  ' +
  Object.keys(r.props).map(k => k + '=' + (Array.isArray(r.props[k]) ? '[' + r.props[k].join('/') + ']' : r.props[k])).join('  ')));

const aliasCount = log.filter(r => r.props['别名']).length;
console.log('\n带别名的枝 ' + aliasCount + ' 个；带朝代的 ' + log.filter(r => r.props['朝代']).length +
  ' 个；带题材的 ' + log.filter(r => r.props['题材']).length + ' 个；带流派的 ' + log.filter(r => r.props['流派']).length + ' 个');

if (!WRITE) { console.log('\n（空跑，未写入。加 --write 才落盘）'); process.exit(0); }
const backup = path.join(HERE, 'data.before-props.json');
if (!fs.existsSync(backup)) { fs.copyFileSync(DATA, backup); console.log('\n✓ 已备份 → ' + backup); }
fs.writeFileSync(DATA, JSON.stringify(data), 'utf8');
console.log('✓ 已写回 ' + DATA + '（' + fs.statSync(DATA).size + ' 字节）');
