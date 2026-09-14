#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成「外发版」：清空个人内容 → 附带美术史树试用代码 → 打绿色版 zip（安装包另调 ISCC）

用法：
    cd /home/elu/test/doc-tool/daosheng-tree
    node tools/make_trial_code.js              # 先由当前数据生成试用代码文档
    python3 tools/build_release.py             # 再打外发版（zip + 安装包）

外发版里放了什么、故意不放什么，见 README「打包发布（外发版）」一节。
"""
import io, json, os, re, shutil, subprocess, sys, zipfile

ROOT      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC       = "/mnt/c/ArborInversa"                                      # 本机应用目录（含个人内容）
STAGE     = "/mnt/c/Users/Public/ArborInversa-release"   # 外发版暂存目录（纯 ASCII，避免命令行传中文路径）
STAGE_WIN = r"C:\Users\Public\ArborInversa-release"
ISCC      = "/mnt/c/Users/大象/AppData/Local/Programs/Inno Setup 6/ISCC.exe"
DIST      = os.path.join(ROOT, "dist")
VER       = "1.0.0"
ZIP_OUT   = os.path.join(DIST, f"ArborInversa-{VER}.zip")
SETUP_OUT = f"ArborInversa-Setup-{VER}.exe"
DESKTOP   = "/mnt/c/Users/大象/Desktop"

# 外发版的数据：一棵空树（不含任何个人内容，只留一句引导）
EMPTY_DATA = {
    "name": "逆生树",
    "leaves": [{
        "name": "概述",
        "desc": ("逆生树（ArborInversa）是一个通用的树状图框架，\n"
                 "纵向生长『枝』，横向展开『叶』。\n其根在上而枝向下。\n\n"
                 "这是一棵空树 —— 点上方「植树」，用文本代码就能种出一整棵树。\n"
                 "随包的《美术史树-试用.txt》是一份完整的示例树（中国美术史）。")
    }],
    "children": []
}

BIN = ["ArborInversa.exe", "ArborInversa.exe.config", "index.html",
       "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll",
       "WebView2Loader.dll"]

# 个人痕迹扫描用的关键词（出现在外发文件里就要报出来）
TRACE = ["大象", "C:\\Users", "c:\\Users", "DaoShengTree", "daosheng", "倒生树",
         "AppData", "Desktop", "zhhistory", "@gmail", "@qq.com", "@163.com"]


def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def main():
    os.makedirs(DIST, exist_ok=True)

    # 1) 试用代码文档（由 make_trial_code.js 从当前数据实时生成）
    trial = os.path.join(ROOT, "dist", "美术史树-试用.txt")
    r = sh(["node", os.path.join(ROOT, "tools", "make_trial_code.js"), trial])
    print(r.stdout.strip() or r.stderr.strip())
    if r.returncode or not os.path.exists(trial):
        print("× 试用代码生成失败，中止")
        return 1

    # 2) 暂存目录
    if os.path.exists(STAGE): shutil.rmtree(STAGE)
    os.makedirs(os.path.join(STAGE, "media"))
    for f in BIN:
        shutil.copy2(os.path.join(SRC, f), os.path.join(STAGE, f))
    for f in os.listdir(os.path.join(SRC, "media")):
        shutil.copy2(os.path.join(SRC, "media", f), os.path.join(STAGE, "media", f))
    with open(os.path.join(STAGE, "data.json"), "w", encoding="utf-8", newline="") as fp:
        json.dump(EMPTY_DATA, fp, ensure_ascii=False, separators=(",", ":"))   # 与程序写出格式一致
    shutil.copy2(os.path.join(ROOT, "win-app", "使用说明-外发版.txt"),
                 os.path.join(STAGE, "使用说明.txt"))
    shutil.copy2(trial, os.path.join(STAGE, "美术史树-试用.txt"))
    print("✓ 暂存目录：", STAGE_WIN)

    # 3) 绿色版 zip
    with zipfile.ZipFile(ZIP_OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(os.listdir(STAGE)):
            p = os.path.join(STAGE, f)
            if os.path.isdir(p):
                for g in sorted(os.listdir(p)):
                    z.write(os.path.join(p, g), f"ArborInversa/{f}/{g}")
            else:
                z.write(p, f"ArborInversa/{f}")
    print(f"✓ 绿色版：{ZIP_OUT}（{os.path.getsize(ZIP_OUT)} 字节）")

    # 4) 安装包：由 setup.iss 生成一份专用脚本（把 SrcDir / OutputDir 写成暂存目录，
    #    全程 ASCII 路径 —— WSL 往 Windows 传中文命令行参数会被编码搞坏，故不用 /D
    if os.path.exists(ISCC):
        iss = io.open(os.path.join(ROOT, "win-app", "setup.iss"), encoding="utf-8-sig").read()
        iss = iss.replace('#define SrcDir "C:\\ArborInversa"', f'#define SrcDir "{STAGE_WIN}"')
        iss = iss.replace("OutputDir=C:\\Users\\大象\\Desktop", f"OutputDir={STAGE_WIN}")
        # 图标不在暂存目录里（绿色版不需要它），指向本机那份即可
        iss = iss.replace("SetupIconFile={#SrcDir}\\ArborInversa.ico",
                          "SetupIconFile=C:\\ArborInversa\\ArborInversa.ico")
        rel_iss = os.path.join(STAGE, "setup-release.iss")
        io.open(rel_iss, "w", encoding="utf-8-sig", newline="").write(iss)
        # 注意：ISCC 是 Windows 程序，脚本路径必须给 Windows 形式，且 cwd 要在 Windows 侧
        r = sh([ISCC, STAGE_WIN + r"\setup-release.iss"], cwd=STAGE)
        if r.returncode or "Successful compile" not in (r.stdout or ""):
            print("× 安装包编译失败（退出码 %s）：" % r.returncode)
            print((r.stdout or "")[-1200:])
            print("STDERR:", (r.stderr or "")[-600:])
            return 1
        built = os.path.join(STAGE, SETUP_OUT)
        shutil.copy2(built, os.path.join(DIST, SETUP_OUT))     # 项目 dist/
        shutil.copy2(built, os.path.join(DESKTOP, SETUP_OUT))  # 桌面
        print(f"✓ 安装包：{SETUP_OUT}（{os.path.getsize(built)} 字节）→ dist/ 与桌面")
    else:
        print("⚠ 没找到 ISCC.exe，跳过安装包（zip 已生成）")

    # 5) 个人痕迹扫描
    print("\n=== 个人痕迹扫描（外发文件里不该出现）===")
    bad = 0
    SKIP = {"setup-release.iss", "unins000.dat", "unins000.exe"}   # 构建脚本／装机时才生成的文件
    for root, _, files in os.walk(STAGE):
        for f in files:
            if f in SKIP:
                continue
            p = os.path.join(root, f)
            raw = open(p, "rb").read()
            hits = set()
            for t in TRACE:
                if t.encode("utf-8") in raw or t.encode("utf-16-le") in raw:
                    hits.add(t)
            if hits:
                bad += 1
                print(f"  ⚠ {os.path.relpath(p, STAGE)} → {sorted(hits)}")
    print("  未发现个人痕迹 ✓" if not bad else f"  {bad} 个文件命中，请检查")

    # 6) 逐文件核对与源目录一致（除刻意替换的那几个）
    print("\n=== 内容核对 ===")
    print("  data.json（外发）= 空树：" , json.load(open(os.path.join(STAGE, "data.json"), encoding="utf-8"))["children"] == [])
    print("  试用代码行数：", sum(1 for _ in open(os.path.join(STAGE, "美术史树-试用.txt"), encoding="utf-8")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
