# ArborInversa · 逆生树 —— 项目文档

> **类型备注：树型思维导图**（tree-style mind map）
> 本文档供人与新会话（新的 AI 对话）快速、无缝接手本项目。
> 文档版本：2026-09-14
> 应用目录：`C:\ArborInversa\`　　｜　　源码/文档目录：`/home/elu/test/doc-tool/daosheng-tree/`

---

## 一、这是什么

**ArborInversa（逆生树）**：一个**树型思维导图**应用 —— 内容存成一棵树，「枝」是节点，「叶」是挂在枝上的正文。
主交付形态是 Windows 独立程序（`ArborInversa.exe`，内置 HTTP 服务 ＋ WebView2 窗口，不依赖 WSL／Node，整个文件夹可拷走）。

### 结构

| | 方向 | 是什么 |
|---|---|---|
| **枝** | 竖向 | 树里的节点；向下可继续长枝，构成骨架 |
| **叶** | 横向 | 挂在枝上的描述板块（正文）；**一根枝可以挂多片叶**，叶名显示在枝名右侧，点击切换 |
| **属性** | — | 枝上的键值对（可选）；键与值都自由定义 |

```
逆生树                        ← 根：整棵树的本体
└ 分支树 A                    ← 根下直接抽出的枝 ＝ 一棵分支树（一个学科／一个主题）
  ├ 分类 A                    ← 分支树下的枝，按时代／门类／题材…逐层细分
  │ ├ 子项
  │ └ 子项
  └ 分类 B
```

层级是**通用的**：**根 → 分支树 → 分类 → 更细的分类**，想分多细就往下长几层。
以「两宋」为例（枝名任取，这里只是示意）：

```
两宋              叶：形势｜变迁｜环     ← 一枝横向挂三片叶，点叶名切换
├ 绘画
│ └ 山水
│   └ 范宽                              ← 属性：朝代／门类／题材／别名…
└ 书法
```

> ★ **仓库自带的是空框架树；一棵真实的示例树（中国美术史，含结构大纲、完整文本代码与写作规范）见 [示例](示例.md)。**

- **层级**：根下直接抽出的枝 ＝ 分支树（可平行挂多棵）；分支树下的枝再按需要分层，层数不限
- **规模**：仓库自带的 `data.json` 是**空框架树**；示例树的规模见 [示例](示例.md)
- **数据字段**：枝 ＝ `{name, props?, leaves, children}`；叶 ＝ `{name, desc}` —— 仅此两种
- **叶里的两种标记**：`[[枝名]]` 生成跳转；`![[图片名]]` 插图，可带题注 `![[图片名|题注]]`

### 内容放在哪

分三层看，**框架与内容分开**：

1. **框架**（与内容无关）：`index.html`／`ArborInversa.exe`／`serve.js`／`tools/` —— 界面、内置服务、植树与搜索、工具脚本
2. **仓库自带的 `data.json` ＝ 空框架树**：只有根「逆生树」＋一句引导语；**clone 下来即可直接跑这套框架**
3. **谁的实际内容**：
   - **你的内容**：`C:\ArborInversa\data.json` —— **不进仓库**（是唯一维护版，见下节）
   - **美术史的示例版本**：仓库里的 [`示例.md`](示例.md)（它长什么样 ＋ 真代码样例 ＋ 完整文本代码 ＋ 写作规范 ＋ 属性规则 ＋ 进度与待办；**生成物，不要手改**）
   - 外发版软件包照旧**带完整美术史**（随包的试用代码，见第九节「打包发布」）

| 文件 | 是什么 |
|---|---|
| `data.json` | 内容（枝、叶、属性）：仓库那份是**空框架树**，应用目录那份是你的内容 |
| `index.html` | 界面（含全部 CSS／JS，无外部依赖） |
| `media/` | 插图 |
| `ArborInversa.exe` | Windows 主程序（内置 HTTP 服务 ＋ WebView2 窗口） |
| `使用说明.txt` | 给最终用户的说明 |

- **应用目录（你的内容正本）**：`C:\ArborInversa\`（可用应用内编辑，也可直接改文件）
- **源码／文档／备份**：`/home/elu/test/doc-tool/daosheng-tree/`（含 `win-app/Program.cs`、`tools/`、`README.md`、`示例.md`）
- **远端仓库**：`https://github.com/uky15498/ArborInversa`（私有）

### 能做什么

| 能力 | 说明 | 详见 |
|---|---|---|
| 浏览 | 三栏工作台：目录树（左）／详情（中）／行动树（右，跳转历史）；栏宽可拖 | 第五节 |
| 编辑内容 | 「编辑当前枝」：改名、加改删属性、增删改叶、上传插图；改完写回 `data.json` | 第五节 |
| 改结构 | 「＋ 在当前枝下抽枝」「⇄ 迁移当前枝」「删除当前枝」 | 第五节 |
| 植树 | 任何一枝都能整棵转成**文本代码**，再种到别处（导出／从文件读取／复制） | 第五节 |
| 交给 AI 写 | 「植树 → 告诉 ai 怎么帮你写」：一键复制一段树语言说明书给任意 AI | 第五节 |
| 搜索 | 全文检索枝名／叶名／叶正文／属性，配**限定栏**（条件行：属性／在枝下／枝名／叶名／正文／深度／含有／排除词） | 第五节 |
| 属性 | 枝名上方「属性 ⁝」展开就地编辑（键值都有常用下拉）；枝名悬停 1 秒浮出只读浮层 | 第四节 |
| 打包发布 | 一键出绿色版 zip ＋ 安装包（Inno Setup），外发版随包一份完整美术史的试用代码 | 第九节 |

---

## 二、使用方式

### ★ 主要形态：Windows 独立应用（不依赖 WSL / Node）

```
C:\ArborInversa\                  ← 整个文件夹拷到任何 Windows 电脑即可运行
└── ArborInversa.exe                    ← 双击启动
```

- **桌面快捷方式**：`逆生树`（桌面文件名 `ArborInversa.lnk`）
- **原理**：exe **内置一个微型 HTTP 服务**（基于 `TcpListener`：自动分配空闲端口、
  只绑定 `127.0.0.1`、**无需管理员权限**），再用 **WebView2 内嵌窗口**显示界面
  —— 因此**无需 Node、无需 WSL、无浏览器界面**。
- **唯一外部依赖**：系统需装 **WebView2 运行时**（Win10/11 通常随 Edge 自带；
  缺失时程序会弹提示）

### 备用形态：WSL 里的 Node 服务（开发用）

```bash
cd /home/elu/test/doc-tool/daosheng-tree
setsid node serve.js 8460 > serve.log 2>&1 &
# 浏览器访问（WSL IP，不能用 127.0.0.1）：
echo "http://$(hostname -I | awk '{print $1}'):8460/"
```

两套后端**接口完全一致**，`index.html` 通用。

---

## 三、目录与文件

### 应用目录 `C:\ArborInversa\`（实际运行处）

| 文件 | 作用 |
|---|---|
| `ArborInversa.exe` | **主程序**（x86，**已内嵌图标**） |
| `ArborInversa.ico` | **程序图标**（7 个尺寸 16/24/32/48/64/128/256，重编译时用 `/win32icon:` 引用） |
| `使用说明.txt` | 给最终用户的说明（绿色版与安装版通用；打包与安装包都带它） |
| `ArborInversa.exe.config` | 高 DPI 配置 |
| `index.html` | **前端页面**（含全部 CSS/JS，无外部依赖） |
| `data.json` | **全部内容**（约 56 KB；**唯一维护版**，应用内编辑会写回此文件） |
| `media/` | **图片目录**（随文件夹一起打包带走） |
| `WebView2Loader.dll` | WebView2 原生依赖（**32 位，必需**） |
| `Microsoft.Web.WebView2.Core.dll`<br>`Microsoft.Web.WebView2.WinForms.dll` | WebView2 托管程序集 |
| `mkshortcut.ps1` | 重建桌面快捷方式 |
| `Program.cs` | 应用源码（便于重建，与源码目录同步） |
| `ArborInversa.exe.WebView2/` | 运行缓存（约 7.5 MB，**拷贝时可删**，首次运行自动重建） |

### 源码/文档目录 `/home/elu/test/doc-tool/daosheng-tree/`

| 文件 | 作用 |
|---|---|
| `README.md` | 本文档 |
| `示例.md` | **美术史示例页**（生成物，**不要手改**）：它长什么样 ＋ 真代码样例 ＋ 完整文本代码 ＋ 写作规范 ＋ 元代范式 ＋ 属性规则 ＋ 进度与待办（由 `tools/make_example_page.js` 生成） |
| `index.html` | 前端源码（改完需 `cp` 到应用目录） |
| `data.json` | **空框架树**（仓库自带，供 clone 后直接跑框架；**不含任何个人内容**） |
| `media/` | 图片源 |
| `serve.js` | 备用 Node 后端 |
| `win-app/Program.cs` | Windows 应用源码 |
| `win-app/旧版-依赖WSL.cs.bak` | 早期依赖 WSL 的版本（留档） |
| `win-app/ArborInversa.ico` | 程序图标（与 `C:\ArborInversa\` 那份同源） |
| `win-app/Etz.png` | **图标原始图**（用户提供的 `Etz.png`，515×421 RGBA） |
| `tools/pngtool.py` | **纯标准库** PNG 解码／缩放／ICO 生成脚本（本机无 ImageMagick、无 Pillow） |
| `tools/codec.test.js` | **树 ⇄ 文本代码**自测（从 `index.html` 抽真实实现来跑，28 项） |
| `tools/search.test.js` | **搜索 与 枝属性**自测（同样抽真实实现，45 项） |
| `tools/seed_props.js` | **按统一规则给全部枝补属性**（示例树用的属性规则；可复跑，`--write` 才写盘，首次自动备份） |
| `tools/snapshot.js` | **校验应用数据 → 同步 `media/` → 重新生成 `示例.md` → 核对仓库 `data.json` 仍是空框架树**（`--check` 只检查） |
| `tools/make_example_page.js` | 由应用数据生成 [`示例.md`](示例.md)（只重生成示例页） |
| `tools/git-hooks/pre-commit` | 提交前自检：两套自测 + `node tools/snapshot.js --check`（`core.hooksPath` 指向它） |
| `tools/make_trial_code.js` | 由当前数据生成**试用代码文档**（外发版用） |
| `tools/build_release.py` | **一键出外发版**：空树数据＋试用代码＋zip＋安装包＋痕迹扫描 |
| `win-app/使用说明-外发版.txt` | 外发版随包的《使用说明.txt》源文件 |
| `win-app/setup.iss` | **安装包**脚本（Inno Setup 6） |
| `dist/` | **发布产物**：绿色版 zip、安装包 exe |
| `data.backup.json`<br>`data.before-*.json` | **历史备份**（10 个，见第九节回退方法） |

### ★ 内容以哪一份为准（2026-09-14 用户确立）

- **唯一维护版 ＝ 应用版**：`C:\ArborInversa\data.json` —— **今后所有内容改动只写这一份**
- 用应用内「就地编辑」修改时，会自动写回该文件（**写出的是单行压缩 JSON**，
  故看到 1 行的 `data.json` 属正常，那是应用写的）
- **仓库不再收你的内容**：仓库里的 `data.json` 是**空框架树**（clone 即可跑框架），
  你的内容不进库；美术史那一棵以 [`示例.md`](示例.md) 的形式进库，由 `tools/make_example_page.js` 生成
  —— **`示例.md` 是生成物，不要手改**（手改了 `--check` 会报不一致）
- 同步（改完内容、提交前跑一次；会先校验 JSON／`[[跳转]]`／属性值类型，再同步 `media/`、
  重新生成示例页，并核对仓库 `data.json` 仍是空框架树）：
  ```bash
  node tools/snapshot.js          # 校验应用数据 → 同步 media/ → 重新生成 示例.md → 核对仓库 data.json 是空框架树
  node tools/snapshot.js --check  # 只检查（pre-commit 钩子跑的就是它）
  node tools/make_example_page.js # 只重新生成 示例.md
  ```
- ⚠️ **永远不要拿仓库那份 `data.json` 覆盖应用版** —— 仓库那份是**空树**，覆盖了就把内容丢了
- 手工备份 `data.before-*.json` 是 git 接管**之前**的做法，今后不必再生成（git 里已有逐次提交）

---

## 四、数据模型（data.json）

### 结构

以示例树里的「两宋」为例（整棵数据、完整代码与属性规则见 [`示例.md`](示例.md)）：

```json
{
  "name": "逆生树",
  "leaves": [ { "name": "概述", "desc": "…（说明逆生树是什么、已有哪些分支树）" } ],
  "children": [
    {
      "name": "中国美术史",
      "leaves": [ { "name": "概述", "desc": "…（本分支树的学科总述）" } ],
      "children": [
        {
          "name": "两宋",
          "props": { "年代": "960—1279", "标签": ["绘画", "书法"] },
          "leaves": [
            { "name": "形势", "desc": "…" },
            { "name": "变迁", "desc": "…" },
            { "name": "环",   "desc": "…" }
          ],
          "children": [ … ]
        }
      ]
    }
  ]
}
```

- **枝的字段**：`name`（枝名）、`props`（**属性，可选**）、`leaves`（叶数组）、`children`（子枝数组）
- **叶的字段**：`name`（叶名）、`desc`（叶的内容）—— 仅此两种
- 层级约定：
  - **根** ＝ 逆生树（框架本体）
  - **根的直接子枝** ＝ **分支树**（一个学科／一个主题一棵，可以平行挂多棵；示例树里是「中国美术史」）
  - **分支树的子枝** ＝ 该分支树的分类（示例树里是它下面的各个时代）
- ★ **属性 `props`**（2026-09-14 加入，参考 **Obsidian 的 Properties**）：
  - 形如 `{"键": "文本"}` 或 `{"键": ["值一", "值二"]}` —— 值**只能是文本或文本数组**
  - **可选字段**：没有属性就不写该字段；值为空的行不写入（`propsOf()` 按「空对象＝没有属性」处理）
  - **两种查看方式**：① 详情页**枝名上方右侧的「属性 ⁝」按钮**，点开是**可就地编辑的属性栏**（推荐）；
    ② 鼠标在**枝名上停留 1 秒**浮出只读浮层（`pointer-events:none`，不挡鼠标；属性栏展开时不再弹）
  - 编辑：`编辑当前枝` → 「属性」区，一行一个键值对；**值用逗号分隔即为多个**（存成数组）
  - 搜索：属性键与属性值**都参与全文检索**，并支持 `键:值` 筛选语法（见第五节「搜索」）
  - 植树代码：`属性 键: 值` 行（见第五节「植树」）

- 属性这一层**与内容无关**；示例树实际用的键、生成规则与条数见 [`示例.md`](示例.md)
- **值类型铁律**：单值写成**文本**，多值写成**数组**；**不要写单元素数组**（编解码会把它还原成文本，
  自测里有这条断言）
- 示例树那套属性由 `tools/seed_props.js` 按统一规则补（可复跑；`--write` 才写盘，首次自动备份
  `data.before-props.json`；脚本**只补自己负责的键，手写属性不会被抹掉**）；规则见 [`示例.md`](示例.md)
- 属性栏里的**常用属性名／常用值**由 `PROP_KINDS`／`PROP_VALUES` 定义（按「类别」分组），
  自测会检查「数据里出现的每种类型都有对应的常用属性表」

- 旧版曾用单一 `desc` 字符串存描述；前端 `leavesOf()` 仍**向后兼容**
  （无 `leaves` 时把 `desc` 视作一片名为「概述」的叶），但**新写入一律用 `leaves`**

---

## 五、界面功能

### 布局：三栏工作台（可拖拽调宽，类 PR 剪辑台）

| 栏 | 内容 |
|---|---|
| 左 | **目录树**（栏目标题只此三字）。多叶的枝，枝名右侧横向显示**叶名小标签** |
| 中 | **详情**：枝的说明行 + 枝名（同轴中心对齐）＋ 右侧横向**叶标签**，点叶名切换该叶内容；叶按钮下方是叶的说明行；再下方为卡片，列出它下面的枝。**枝名上方右侧有「属性 ⁝」按钮，点开即就地编辑属性栏**（放在枝名之上，免得与叶标签挤）；鼠标在枝名上停 1 秒也会浮出属性 |
| 右 | **行动树 ⇄ 搜索**：标题下方两个小标签切换（形式同叶的切换）。「行动树」＝跳转历史（持久化到 localStorage，键名 `arborinversa_nav`）；「搜索」＝全文检索，见下 |

### 工具栏

| 按钮 | 功能 |
|---|---|
| 编辑当前枝 | 改枝名 + **加改删属性（键值对）** + 增删改多片叶 + 「插图」上传图片 + 「＋ 展叶」加一片新叶 |
| ＋ 在当前枝下抽枝 | 在当前枝下面抽出一枝新的（自动带一片空的「概述」叶） |
| 植树 | **用文本代码导入／转写整棵树**（见下「植树 · 树的文本代码」） |
| ⇄ 迁移当前枝 | 弹窗选一个目标位置，整枝移走（有防自环、防移到自己下面的校验） |
| 删除当前枝 | 带确认框删除当前枝及它下面的所有枝（根不可删） |
| ⌂ 根 | 回到根 |

### ★ 搜索（右栏「搜索」标签，2026-09-14 加入）

搜索页 ＝ **关键词框** ＋ **限定栏**（条件行，可并行多条）。**日常用限定栏，不必背语法**；
语法仍可用，且与限定栏叠加。

- **入口**：右栏标题下的「搜索」标签；或按 **Ctrl+K**（不用 Ctrl+F —— 那是 WebView2 自带的查找）。
  切进来时若右栏窄于 300px 会自动撑到 320px（限定栏需要地方）
- **关键词框**：普通词（空格分隔 ＝ 都要命中）、`"整段短语"`、`-排除词`，也可以直接写下面任何语法。
  **关键词永远必须命中**，不受「并且／或者」影响

#### 限定栏（条件行）

```
[＋ 条件] [用当前枝] [并且 ▾] [清空]
┌──────────────────────────────┐
│ 属性 ▾   标签    山水     删 │
│ 在枝下 ▾ 元代             删 │
└──────────────────────────────┘
等价语法：标签:山水 下:元代（点一下转进关键词框）
命中 3 处
```

| 维度 | 说明 |
|---|---|
| **属性** | 属性名 ＋ 属性值（下拉列出数据里已有的属性与值；键名可只写一部分，如 `标签`） |
| **在枝下** | **范围限定**：只在这根枝及其下级里找（下拉列全部枝名；「用当前枝」＝一键把当前枝设为范围） |
| 枝名／叶名／正文 | 该字段含这个词 |
| 深度 | 层级深度（根 ＝ 0） |
| 含有 | 含插图／含跳转链接／有下级枝 |
| 排除词 | 含这个词的枝、叶一律不列 |

- **并行规则**：多条条件用 `并且` 或 `或者` 组合；**多条「在枝下」取并集**（＝搜这几棵子树）
- **一键转语法**：限定栏下方实时显示等价语法，点一下即可把条件转进关键词框（想微调时很方便）
- **属性开箱可用**：候选键与候选值都由数据里已有的属性现算（下拉直接列出来），
  所以属性维度**开箱可用**，例如「在枝下＝某个分类 ＋ 属性 类型＝画家」；
  示例树用的属性键与条数见 [`示例.md`](示例.md)，写法见第四节「★ 属性 `props`」

#### 关键词语法（高级通道）

| 语法 | 含义 |
|---|---|
| `词 词` | 多个词**都要命中**（AND） |
| `"整段短语"` | 精确短语（含空格） |
| `-词` | **排除**含该词的枝／叶（含枝名） |
| `枝:南宋` | 限定**枝名**（只认这根枝自己的名字；搜子树请用 `下:`） |
| `叶:形势` | 限定**叶名** |
| `文:披麻皴` | 限定**叶正文** |
| `下:元代`（＝`在:元代`） | **限定范围**：只在这根枝及其下级里找 |
| `标签:山水` | **属性筛选**（任意属性名，键名不必写全） |
| `有:别名` | 该枝**拥有**这个属性 |
| `深:6` | **层级深度**（根 ＝ 0） |
| `含:图`／`含:链` | 含插图／含跳转链接（叶级） |
| `含:下枝` | 还有下级枝（枝级） |

- **结果**：每条 ＝ 一个「枝」或「枝 › 叶」；点一下（或回车）即跳过去，**命中叶正文时直接切到那一片叶**；
  命中词以 `<mark>` 高亮，正文命中给出上下文片段；默认按相关度排序（枝名 > 叶名 > 属性 > 正文）
- **键盘**：`↑` `↓` 选择、`Enter` 跳转、`Esc` 依次 清关键词 → 清条件 → 回「行动树」
- **枝级约束 vs 内容词**：`枝:`／`有:`／`深:`／`下:`／任意属性筛选是**枝级约束**，只作用于「这个枝」；
  **单独使用它们时只列枝**，不会把该枝下面每一片叶各列一行
- 实现全在 `index.html` 的 `==== 搜索 BEGIN / END ====` 区块：`sTokens()`／`rowsToTokens()`（词条）
  → `runQuery()`（范围 + 并行规则 + 打分排序）→ `highlight()`／`snippetAround()`；
  限定栏的候选值由 `allPropKeys()`／`allPropVals()`／`allBranches()` 从数据里现算
- **故意不建索引**：每次输入 120ms 防抖后**全量扫描**，量级不大时是毫秒级
  （示例树那一棵：260 余个单位、1.5 万字，规模见 [示例](示例.md)）；结果最多显示前 200 条
- **自测（改完搜索引擎务必跑）**：`node tools/search.test.js` —— 覆盖语法解析、各字段语法、
  AND／排除／短语、**范围限定**、`含:` 维度、**条件行映射**、**并且/或者**、属性筛选、高亮转义、
  片段截断、排序与跳转路径，当前 **45 项全通过**

### ★ 界面文案规范（2026-09-14 用户确立）

- **「枝」就叫枝，「叶」就叫叶**；两者并列时写「**枝、叶**」
  ——**界面文案里不出现「枝叶」这个合成词**
- **同样不用「子枝／子叶／父枝／子级」等合成词**：层级关系一律用大白话表达
  （「下面的枝」「上一层」「下级」「下含」…）
- **一律不用 emoji**（📁 🧭 🍃 🖼 🗑 ✏ ✓ ✕ 🡒 等已清除）；
  纯排版符号可留：`＋ ⇄ ⌂ ▼ ● ○ → ⁝`（**属性按钮与它的两个选择器用「⁝」**；`▼` 只留给「▼ "X" 下的枝」这个分区标题）
- **不用「末端枝／末端」这类临时说法**：没有下级的枝显示为「**无下枝**」
  （枝的说明行：`枝　下含 N 枝`／无下级时只显示 `枝`；卡片角标：`下含 N 枝`／`无下枝`）
- **两条说明行的位置**（用户指定）：
  - 枝的说明（`枝　下含 N 枝`）**挂在枝名上方**，并与枝名**同轴中心对齐**：
    两者装在同一个「宽度取较宽者」的列里（`.name-col`），所以
    **必有一个是左对齐的**——枝名长则枝名左对齐、说明宽则说明左对齐，整列本身仍靠左缘
    （不放在枝名下方，避免与下方那条叶说明抢位；叶名按钮与枝名底线对齐）
  - 叶的说明（`叶　当前第 x 叶`，x ＝当前叶的次序）**挂在叶名按钮下方**，
    其**水平中心实时跟随当前选中的那片叶的按钮**（`placeLeafMeta()`，受窗口缩放与拖栏触发）
- **分隔符用全角空格**（U+3000），不用中点「·」
- **栏目标题只保留主名**：左栏只写「**目录树**」、右栏只写「**行动树**」，
  不带「（枝 · 纵向）」这类方向后缀，也不带「· 跳转历史」
- **多叶提示行已删除**：原「共 N 片叶 — 点上方叶名横向切换」不再出现，
  叶的次序与总数由「叶　当前第 x 叶」说明行承担
- **取舍原则：通用、简洁最优先**
- **尺度的分界**：表示结构支撑的**子母关系**词汇（子枝／母枝）**只允许出现在技术文档里**
  （本文档第四、七节等），**一律不得出现在界面文案中**

### 交互细节（用户明确要求过，改动时勿违背）

- 点树中枝 → 切换到该枝（当前叶重置为第一片）
- **当前枝**：绿底 `#e3ece4` + **加粗**；**其后代**：浅绿底 `#f0f5f0`
- ★ **文字颜色一律保持黑色**（用户明确要求：着色不得改变字色）
- **当前枝所在层级的连线**：灰色虚线 → **绿色实线加粗**（`2px solid #8fb3a1`）
- 目录树缩进紧凑（`margin-left:9px; padding-left:6px`）
- 右栏（行动树）可拖到很窄（最小 110px）；每条历史**两行**：
  第一行名称（可折行），第二行位置路径（单行省略）
- 高 DPI：程序声明 **PerMonitorV2**，文字按原生像素渲染（否则会发虚）
- **属性栏**（详情页「属性 ⁝」，位于枝名上方右侧）：每行 ＝ 属性名 ＋ ⁝ 选常用名 ＋ 值 ＋ ⁝ 选常用值 ＋ 删；⁝ 里按当前**类别**列出常用属性名／常用值，
  也可以直接手填；**改完即存**（blur／选值即写回 `data.json`，会有「属性已保存」提示），
  只有结构性改动（改属性名、加一条、删一条）才整块重绘，避免打字时丢焦点

### 叶内容语法

| 语法 | 效果 |
|---|---|
| `[[枝名]]` | **跳转链接**，点击跳到该枝（按名称全树索引；重名时取遍历中较后者） |
| `![[图片名]]` | **插入图片**（从 `media/` 读取） |
| `![[图片名\|题注]]` | 插入图片并带题注 |

> 渲染顺序：先切出 `![[…]]` 图片片段，其余文本再走 `[[…]]` 链接解析（`renderRich()`）。
> ⚠️ 做链接校验时**必须先剔除 `![[图片]]`**，否则会误报无效链接。

### 植树 · 树的文本代码（2026-09-14 加入）

**任何一个枝，连同它下面的所有枝与叶，本身就是一棵完整的树**——可以整棵转成文本代码，再种到别处。

```
枝 两宋
  属性 年代: 960—1279
  属性 标签: 绘画, 书法

  叶 形势
    叶的正文从这一行开始，可以写很多行；
    缩进比「叶」行更深的，全都算这片叶的内容。

  枝 绘画
    叶 概述
      ……
```

| 写法 | 含义 |
|---|---|
| `树 名称` | **整棵树的标题**，只认最上面一行，其下语句即正文 |
| `枝 名称` | 一根枝；从它开始就是一棵子树 |
| `叶 名称` | 一片叶；**它的内容 ＝ 紧跟其后、缩进比它更深的所有行** |
| `属性 键: 值` | **该枝（或该树）的属性**，写在所属枝行下方、与「叶」行同级；值用逗号分隔即为多个 |

- 缩进：空格 1 列、Tab 4 列、全角空格 2 列（列 ≠ 字符数，`codeStripIndent()` 专门处理这点）
- **更深的缩进一律算内容**：叶里出现「枝 X」「叶 X」这样的行不会被误当结构
- 叶内容的**尾部空行、行尾空格不入码**（编解码的既定边界）
- 出错报行号：`代码有误 —— 第 3 行：只能以「树 名称」「枝 名称」「叶 名称」开头…`
- 实现：`index.html` 里以 `==== 树 ⇄ 文本代码 BEGIN / END ====` 标出的**纯函数**，
  不依赖 DOM，方便单测：`treeToCode()`（导出）、`codeToTree()`（导入）、`codeIndentOf()`／`codeStripIndent()`

「植树」弹窗：

| 按钮 | 作用 |
|---|---|
| 生成当前枝的代码 | 把**当前枝整棵**转成代码填进框里（＝导出） |
| 从文件读取 | 选一个 `.txt` 读进输入框 |
| 复制 / 清空 | 复制到剪贴板 / 清空输入框 |
| 植树 | 解析框里的代码并种下去 |
| **语法** | **点击展开**语法说明（默认收起，与搜索页「语法」同一套设计；不再常驻占地方） |
| **告诉 ai 怎么帮你写** | **点击展开**一段**面向 ai 的树语言说明书**，可一键复制后发给任意 ai —— 它便能替你写出合规代码 |

**落点规则**（当前枝 ＝ C）：

1. 代码那棵树的根枝**与 C 同名** → **就地覆盖 C 的叶与下枝**（有确认框）
2. 其它名字的枝 → 作为 **C 的新下枝**；C 下已有同名枝则逐个问是否覆盖
3. 只有叶的代码（如 `叶 形势` …）→ 直接往 **C 上加叶**

于是「根本来是空的 → 导入一棵树 → 就有了内容」这条路是通的：
在根上写 `树 逆生树` ＋ 全部内容，植树即可整体重建。

**「告诉 ai 怎么帮你写」（2026-09-14 加入）**：把整套树语言写成一份 ai 可直接照做的说明书
（`index.html` 里的 `AI_GUIDE`，共 47 行、约 1100 字），内容包括：
语句四型（`树`／`枝`／`叶`／`属性`）、缩进与层级的判定、叶正文的归属规则、属性的写法与值类型、
`[[枝名]]`／`![[图片名]]` 两种标记、排版规范（『』引号、空行、时代标配三片叶），
外加一段完整示例与「输出前自检」清单；并要求 ai **只输出代码、不要解释、不要 Markdown 围栏**。
按钮会把这段文字填进只读文本框并**一键复制**，用户粘贴到任意 ai 对话框即可。

**自测（改完编解码务必跑）**：

```bash
cd /home/elu/test/doc-tool/daosheng-tree && node tools/codec.test.js
```

它**直接抽取 `index.html` 里的真实实现**来测（不依赖浏览器），覆盖整棵树往返、任意子树往返
（中国美术史／两宋／元代／绘画／元四家）、空树、内容里含关键字行、多行与空行、Tab／全角空格缩进、
缩进错误报行号、只有叶的代码、`树` 标题行、五层嵌套、名字带空格、**属性往返／多值数组／全角冒号／
属性写在叶内容里不误判／无属性不生成属性行／属性行写错报行号** —— 当前 **28 项全通过**。
与现有数据相比**只有 1 处规范化差异**（根「概述」叶的尾部空行被裁掉）。

---

## 六、内置服务接口

两套后端（exe 内置的 C# 版 / WSL 的 Node 版）**接口完全一致**：

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/` | 返回 `index.html` |
| GET | `/data` | 返回 `data.json` |
| POST | `/save` | 接收完整 JSON，写回 `data.json`（校验须含 `name` 字段） |
| POST | `/upload` | 接收 `{name, data:dataURL}`，图片写入 `media/`，返回 `{ok, name}` |
| GET | `/media/<文件名>` | 返回图片（按扩展名设 Content-Type） |

- **安全**：文件名经 `Path.GetFileName()` / `path.basename()` 防目录穿越；同名自动加序号不覆盖
- **支持格式**：png / jpg / jpeg / gif / webp / svg / bmp / avif
- Node 版固定端口 **8460**；exe 版**自动分配空闲端口**
- 改 `serve.js` 或重编译 exe 后需重启；改 `data.json` / `index.html` 只需刷新页面

---

## 七、文本代码写作规范（通用）

这套文本代码（植树用的那套）只有四种语句，写法与内容无关，通用：

| 要写对 | 规则 |
|---|---|
| **语句** | 每行以 `树 名称`／`枝 名称`／`叶 名称`／`属性 键: 值` 开头；`树` 只认最上面一行 |
| **缩进** | 缩进表示层级：空格 1 列、Tab 4 列、全角空格 2 列（列 ≠ 字符数） |
| **叶内容的归属** | 一片叶的内容 ＝ 紧跟其后、缩进比它更深的所有行；比「叶」行更深的缩进一律算内容，不会被误当结构 |
| **叶里的分段** | 分段用**空行**；正文尾部的空行与行尾空格不入码 |
| **引号** | 统一用 `『』`（书名／术语／称号） |
| **跳转** | 描述里提到的**已有枝名**写成 `[[枝名]]`，点一下即跳过去 |
| **图片** | `![[图片名]]`，可带题注 `![[图片名\|题注]]`（图片放在 `media/`） |
| **属性** | `属性 键: 值` 写在所属枝行下方、与「叶」行同级；**值用逗号分隔即为多个**（存成数组） |

- 更细的语法与报错行为见第五节「植树 · 树的文本代码」；面向 ai 的说明书由植树弹窗
  「告诉 ai 怎么帮你写」一键给出
- **示例树（中国美术史）自己遵循的写作规范** —— 那一棵树的枝怎么分层、每枝挂哪几片叶、
  叶里写什么文体、脉络怎么连 —— 见 [示例](示例.md)

---

## 八、已知的坑与环境约束

1. **★ Node 内置 `fetch`(undici) 访问外网会 `ETIMEDOUT`** —— 本机实测：`curl` 通、
   DNS 通、本机内网通，唯独 undici 挂。**需要联网请一律用系统 `curl`**。
2. **避免在 WSL 内部嵌套调用 `wsl.exe`**（如 `wsl.exe -l -q`）——
   方向很重要：**Windows 程序调 `wsl.exe` 安全；WSL 里再调 `wsl.exe` 是反向嵌套，应回避**。
   取 WSL IP 用 **`hostname -I`**。
3. **重编译 Windows 应用必须加 `/platform:x86`**：WebView2 依赖 DLL 取自 **32 位 Office**，
   若用 csc 默认的 AnyCPU（在 64 位系统按 64 位运行），会因 `WebView2Loader.dll`
   架构不匹配而**初始化失败**（现象：窗口出来了但内容空白，且不报错）。
4. **`.ps1` 脚本里不要出现中文（含注释）**：Windows PowerShell 5.1 会把无 BOM 的 UTF-8
   文件按 ANSI(GBK) 读取，中文会**破坏脚本解析**（曾导致路径变量变空、快捷方式存错位置）。
   需要中文名就用 `[char]0xXXXX` 码点构造。
5. **文字发虚 = 缺 DPI 感知**：不声明 DPI 感知的程序会被系统位图拉伸（图片看不出，文字很明显）。
   已在代码里声明 PerMonitorV2。
6. **WSL IP 会变**：重启 WSL 后需重新 `hostname -I`（仅备用形态需要）。
7. **中文文件名可用**（`media/示例-汝窑天青釉.svg` 已验证），但 URL 需转义。
8. 系统 Python 3.14 无 pip／编译器 —— 本项目纯 Node / 纯 C#，不受影响。
9. **Windows 应用本体不依赖 npm 包**，也不用 `node_modules`，可任意目录迁移。

---

## 九、常见操作

### 改内容（推荐：应用内）

启动 `ArborInversa.exe` → 左树选枝 → 「编辑当前枝」→ 改文字／展叶／插图 → 「保存到文件」。
（自动写回 `C:\ArborInversa\data.json`）

### 改内容（批量／脚本）

直接读改写应用目录那份 `data.json`。**批量修改前务必备份**：

```bash
cp /mnt/c/ArborInversa/data.json /mnt/c/ArborInversa/data.before-<改动名>.json
```

脚本模式（按枝名路径定位 → 修改 → 写回）：

```bash
node -e '
const fs=require("fs");
const P="/mnt/c/ArborInversa/data.json";
const d=JSON.parse(fs.readFileSync(P,"utf8"));
const at=(parts)=>{let n=d;for(const p of parts){n=n.children.find(c=>c.name===p);}return n;};
at(["中国美术史","两宋","绘画","山水"]).leaves[0].desc="新内容";
fs.writeFileSync(P,JSON.stringify(d,null,2),"utf8");
console.log("✓ 已写回");'
```

### 版本管理（git，2026-09-14 建立）

- **仓库就在源码目录**：`/home/elu/test/doc-tool/daosheng-tree/.git`（本地库，分支 `main`）
  —— ⚠️ **不要**在上级 `/home/elu/test` 上 init（那里有课表、视频等无关文件）
- 身份：`user.name=elu`／`user.email=elu@localhost`（仅本仓库；将来推远端时改成对应账号邮箱）
- **提交前自检钩子**（已启用 `core.hooksPath=tools/git-hooks`）：自动跑
  `codec.test.js` → `search.test.js` → `snapshot.js --check`，任一不过就中止提交
- **`.gitignore` 取舍**：
  - 不进库：`dist/`（安装包与 zip，可由脚本重建）、`__pycache__/`、`*.pyc`、`serve.log`、`*.WebView2/`、系统垃圾
  - **必须进库**：三个 WebView2 DLL、`ArborInversa.ico`、`Etz.png`、`setup.iss`（缺了别人编不出 exe）
  - `data.before-*.json` 作为「git 之前的历史档案」**故意保留在库内**
- **日常流程**：改内容 → `node tools/snapshot.js` → 跑自测 → `git commit`
- **发布打标签**：`git tag -a v1.0.0 -m "…"`；产物由 `python3 tools/build_release.py` 从当前工作区重建，
  所以**打包前先提交**，让 tag 与 `dist/` 内容对得上
- **远端（2026-09-14 建立）**：`https://github.com/uky15498/ArborInversa`（**私有**）；
  `main` 与标签 `v1.0.0` 已推送，本地 `main` 跟踪 `origin/main`
- ★ **推送通道（2026-09-14 定为 SSH ＋ Deploy key，已实测可用）**：
  - 本机专用钥匙 `~/.ssh/arborinversa_ed25519` ＋ `~/.ssh/config` 里的别名 `github-arborinversa`
    —— 走 **`ssh.github.com` 的 443 端口**（WSL 直连 `github.com:22` 不通，443 通）
  - 远端已登记对应的 **Deploy key**（仓库 Settings → Deploy keys，**必须勾 Allow write access**）
  - `origin` 已指向别名 `github-arborinversa:uky15498/ArborInversa.git`，
    **直接 `git push` 即可** —— 不用 token、不用开 Watt Toolkit；换机器记得带上那把私钥
  - 验证：`ssh -T git@github-arborinversa` 应回
    `Hi uky15498/ArborInversa! You've successfully authenticated`
- 备用通道（HTTPS 走 Watt Toolkit 加速器，**需要 token，那枚已作废**，仅留档）：
  Watt Toolkit 会把 `github.com` 写进 Windows hosts 指向 `127.0.0.1`，而 **WSL 里的 `127.0.0.1` 是 WSL 自己**，
  所以 WSL 直接走 HTTPS 必然失败。当时的解法：转发脚本 `~/.config/arborinversa/github-relay.js`
  （只把 github 系域名送到 `172.19.32.1:443` 的加速器）＋ 加速器根证书
  `~/.config/arborinversa/steamtools-ca.pem`（中间人签发者 `CN=SteamTools Certificate / O=BeyondDimension`）
  ＋ `sh ~/.config/arborinversa/gh.sh push`（脚本自己用 `-c http.proxy=…` 传入，
  **不依赖仓库 local 配置**；推时 Watt Toolkit 必须开着）
- 备选远端：`gitee.com`／`gitcode.com` 实测可直连（不受上面那套影响），需要时再加一个 remote 推一份

### 校验（改完必做）

```bash
node -e '
const d=JSON.parse(require("fs").readFileSync("/mnt/c/ArborInversa/data.json","utf8"));
const names=new Set();let tot=0,leaf=0,props=0,badProp=[];
(function w(n){tot++;names.add(n.name);leaf+=(n.leaves||[]).length;
 const p=n.props;
 if(p&&typeof p==="object"&&!Array.isArray(p)){Object.keys(p).forEach(k=>{props++;
   const v=p[k];if(typeof v!=="string"&&!(Array.isArray(v)&&v.every(x=>typeof x==="string")))badProp.push(n.name+"."+k);});}
 (n.children||[]).forEach(w);})(d);
let links=0,bad=[];
(function w(n){for(const l of (n.leaves||[])){const t=(l.desc||"").replace(/!\[\[[^\]]+\]\]/g,"");
for(const m of t.matchAll(/\[\[([^\]]+)\]\]/g)){links++;if(!names.has(m[1]))bad.push(m[1]);}}(n.children||[]).forEach(w);})(d);
console.log("枝:",tot,"| 叶:",leaf,"| 链接:",links,"| 无效链接:",bad.length?[...new Set(bad)].join(","):"无",
 "| 属性:",props,badProp.length?("（值类型有误: "+badProp.join(",")+"）"):"");'
```

### 回退到某个历史版本

```bash
cp /home/elu/test/doc-tool/daosheng-tree/data.before-XXX.json /mnt/c/ArborInversa/data.json
```

可用备份（源码目录内）：`data.backup.json`（最早期）、
`data.before-leaves.json`（引入叶之前）、`data.before-era-leaves.json`（配三叶之前）、
`data.before-mq-split.json`（拆分明清前）、`data.before-image.json`（插图前）、
`data.before-yuan.json`（补元代内容前）、`data.before-yuanfig.json`（加元代画家前）、
`data.before-daosheng.json`（改组为逆生树前）、
`data.before-overview.json`（改根「概述」为新名前，即改名后的应用版原样）、
`data.before-uiwording.json`（界面文案统一前）、
`data.before-props.json`（统一补属性前）

### 重新编译 Windows 应用（★ 在 Windows 侧执行）

```bat
cd C:\ArborInversa
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /platform:x86 /codepage:65001 ^
  /out:ArborInversa.exe /win32icon:ArborInversa.ico ^
  /reference:System.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll ^
  /reference:Microsoft.Web.WebView2.Core.dll /reference:Microsoft.Web.WebView2.WinForms.dll ^
  Program.cs
```

### 关于图标（2026-09-14 用户提供）

- 原始图：用户放在桌面的 `Etz.png`（**1914×1565**、8 位 RGBA，2026-09-14 16:47 版），副本存 `win-app/Etz.png`
  —— 对原图尺寸无要求，换图后重跑下面这条命令即可（解码 3 秒内完成）
- 生成方式：`tools/pngtool.py` 纯标准库解码 → 按 alpha 包围盒裁掉空白 → 居中放进
  正方形透明底（四周留 4% 余量）→ 面积平均缩放（alpha 预乘，避免透明边缘发黑）
  → 写出 7 尺寸 `ArborInversa.ico`（每张以 32bpp BMP DIB 存放，兼容性最好）
- 重新生成（图换了就重跑一次）：

```bash
cd /home/elu/test/doc-tool/daosheng-tree/tools
python3 -c "
import sys; sys.path.insert(0,'.')
from pngtool import decode_png, alpha_stats, crop_pad_square, resize_area, write_ico
w,h,px=decode_png('/mnt/c/Users/大象/Desktop/Etz.png')
side,master=crop_pad_square(w,h,px,alpha_stats(w,h,px)[3],0.04)
write_ico([(s,resize_area(side,side,master,s,s)) for s in (16,24,32,48,64,128,256)],
          '/mnt/c/ArborInversa/ArborInversa.ico')"
```

- **替换 exe 的图标必须重编译**（`/win32icon:`）；若 exe 正被运行中的程序占用，会报
  `CS0016 无法写入输出文件` —— 先把应用关掉再编译
- 桌面快捷方式图标取自 exe，重编译后若显示未更新，重跑一次 `mkshortcut.ps1`

### 打包发布（2026-09-14）

分两套：**本机自用版**（含你的美术史内容）与 **外发版**（不含任何个人内容，随包一份试用代码）。
**外发版的空树里不放美术史，但随包的那份试用代码就是完整美术史** —— 别人下载软件照样能拿到全部内容
（仓库里则以 [示例](示例.md) 的形式公开同一棵树）。

产物都在 `dist/`，桌面也各放一份。

**① 绿色版 zip**（解压即用，不含安装程序）

```bash
cd /home/elu/test/doc-tool/daosheng-tree
python3 - <<'EOF'
import zipfile, os
SRC='/mnt/c/ArborInversa'; OUT='dist/ArborInversa-2026-09-14.zip'
KEEP=['ArborInversa.exe','ArborInversa.exe.config','index.html','data.json','使用说明.txt',
      'Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','WebView2Loader.dll']
with zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for f in KEEP: z.write(os.path.join(SRC,f),'ArborInversa/'+f)
    for f in sorted(os.listdir(os.path.join(SRC,'media'))):
        z.write(os.path.join(SRC,'media',f),'ArborInversa/media/'+f)
EOF
```

- **打进包**：exe、exe.config、index.html、data.json、使用说明.txt、三个 WebView2 DLL、media/
- **故意不打进包**：`ArborInversa.exe.WebView2/`（32 MB 运行缓存，首次运行自动重建）、
  `Program.cs`、`mkshortcut.ps1`、`ArborInversa.ico`、`setup.iss`（只在重编译／重打包时才用）

#### 外发版（一条命令搞定）

```bash
cd /home/elu/test/doc-tool/daosheng-tree
python3 tools/build_release.py
```

它会依次：① 由当前数据生成试用代码 → ② 在 `C:\Users\Public\ArborInversa-release` 暂存外发文件
→ ③ 打绿色版 zip → ④ 编译安装包 → ⑤ **自动扫描个人痕迹**。

| 外发版里 | 说明 |
|---|---|
| `data.json` | **空树**：只有根「逆生树」＋一句引导语（「这是一棵空树 —— 点上方『植树』…」） |
| `美术史树-试用.txt` | **由当前数据实时生成**的「中国美术史」整棵树代码（当前 **121 枝／141 叶／1,146 行／69,730 字节**）；UTF-8 带 BOM、CRLF，记事本可直接打开 |
| `使用说明.txt` | 用 `win-app/使用说明-外发版.txt`（首节就写「第一次打开：先种一棵树」的三步操作） |
| 不含 | 你的任何内容（已换成空树）、`Program.cs`、`mkshortcut.ps1`、`setup.iss`、`.ico`、WebView2 缓存 |

- 试用流程：打开 → 「植树」→「从文件读取」选 `美术史树-试用.txt`（或记事本复制粘贴）→「植树」
- 痕迹扫描关键词：`大象`／`C:\Users`／`daosheng-tree`／`倒生树`／旧 localStorage 键名 `zhhistory` 等，
  命中就报出来（`unins000.*` 是装机时才生成的、天然带本机安装路径，已排除）
- ⚠️ 为躲开「WSL 往 Windows 传中文命令行参数会被编码搞坏」这个坑，外发版**不用 `ISCC /D`**，
  而是由 `win-app/setup.iss` 现场生成一份专用 `.iss`（把 `SrcDir`／`OutputDir` 改写成暂存目录）再编译；
  暂存目录也特意选纯 ASCII 路径
- **验证手段**：静默装到临时目录（`/VERYSILENT /DIR=…`）后检查装出来的 `data.json` 是否空树、
  试用文档是否在、再静默卸载（`unins000.exe /VERYSILENT`）——2026-09-14 实测通过

**② 安装包**（Inno Setup 6；中英双语向导、开始菜单项、卸载项、可改安装目录）

```bat
cd C:\ArborInversa
"C:\Users\大象\AppData\Local\Programs\Inno Setup 6\ISCC.exe" setup.iss
:: 产物：C:\Users\大象\Desktop\ArborInversa-Setup-1.0.0.exe
```

- 脚本：`win-app/setup.iss`（与应用目录那份同步，改完两边都要更新）
- 装到 **`{localappdata}\ArborInversa`**（免管理员）——程序要能在自己旁边写 data.json，
  所以**不能**装到 `C:\Program Files`
- `data.json` 与 `media\*` 标为 `onlyifdoesntexist uninsneveruninstall`：
  **升级不覆盖用户内容、卸载不删用户内容**（2026-09-14 实测：卸载后 data.json／media 仍在）
- 安装时检测 WebView2 运行时（注册表 `EdgeUpdate\Clients\{F3017226-…}`），缺了会提示并可打开下载页
- Inno Setup 6.7.3 按当前用户装在本机 `%LOCALAPPDATA%\Programs\Inno Setup 6\`；
  简体中文语言文件取自官方仓库 `Files/Languages/ChineseSimplified.isl`，另存为
  `Languages\ChineseSimplified.isl`（UTF-8 带 BOM），向导默认中文
- ⚠️ 替换图标／改前端后，**安装包要重新编译**才会带上新内容（zip 也要重新打）

### 改前端页面后同步到应用目录

```bash
cp /home/elu/test/doc-tool/daosheng-tree/index.html /mnt/c/ArborInversa/index.html
```

---

## 十、待办 / 可扩展方向

**内容层面**的待办（示例树里哪些枝干还没梳理好）见 [示例](示例.md)；这里是**框架与仓库**层面的：

- [ ] 逆生树根下挂接**其它分支树**（框架已支持，尚无第二棵）
- [ ] 可选：叶内图片的尺寸／对齐控制（如 `![[图|题注|300]]` 指定宽度、图文并排）
- [x] 应用图标（2026-09-14 完成：`Etz.png` → 7 尺寸 ico，已内嵌 exe）
- [x] **枝属性（`props`，参考 Obsidian Properties）＋ 详情页属性栏 ＋
  全文搜索 ＋ 限定栏（条件行）（2026-09-14 完成；示例树用的属性规则与条数见 [示例](示例.md)）**
- [x] 安装包与绿色版打包（2026-09-14 完成：`win-app/setup.iss` → Setup.exe；`dist/`）
- [x] 仓库门面改为**框架为主**：仓库 `data.json` 换成空框架树，美术史内容移入 [示例](示例.md)（2026-09-14）
- [ ] 可选：给 exe 加版本元数据（右键属性→详细信息里的版本/产品名/版权）
- [ ] 可选：代码签名，消除首次运行的 SmartScreen 提示

---

## 十一、给新会话的一句话提示

> 项目是 **ArborInversa（逆生树）**，一个**树型思维导图**：**竖向的是枝、横向的是叶**，一枝可挂多片叶，
> 枝上还可带属性（键值对）。结构、字段见第一节。
> **仓库以框架为主**：仓库自带的 `data.json` 是**空框架树**（clone 下来即可跑框架），
> 美术史那棵树作为示例放在 [示例](示例.md)（说明、结构大纲、完整文本代码与写作规范都在那里）。
> 主交付形态是 Windows 独立应用 `C:\ArborInversa\ArborInversa.exe`（内置 HTTP 服务 ＋ WebView2，
> 不依赖 WSL／Node，可整体拷走）；**你的内容以 `C:\ArborInversa\data.json` 为准**（唯一维护版，不进仓库），
> 源码／文档／工具在 `/home/elu/test/doc-tool/daosheng-tree/`，远端私有库 `github.com/uky15498/ArborInversa`。
> 改完内容跑 `node tools/snapshot.js` 再提交（提交钩子会跑两套自测，并核对仓库 `data.json` 仍是空框架树）；
> **不要擅自给示例树里还没梳理好的枝干添枝**。
