#!/usr/bin/env python3
"""
build.py - CTZ's Flash Garden 构建脚本

首次运行自动创建 .venv 并安装依赖，之后秒开。

用法:
    python3 build.py [--base /ctz-flash] [--out dist]
"""

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV = ROOT / ".venv"
VENV_PY = VENV / "bin" / "python3"
PIP = VENV / "bin" / "pip"

NOTES_DIR = ROOT / "notes"
ATTACH_DIR = NOTES_DIR / "attachments"
ASSETS_DIR = ROOT / "assets"
INDEX_SRC = ROOT / "index.html"

REQUIRED_FIELDS = ("title", "date", "tags", "summary", "slug")
WIKI_LINK_RE = re.compile(r"\[\[([^\]\n]+?)\]\]")


# ── 依赖管理 ──────────────────────────────────

def _ensure_venv():
    if VENV.exists():
        # 当前不在 .venv 中 → 用 .venv 的 python 重新运行
        if sys.executable != str(VENV_PY):
            subprocess.run([str(VENV_PY), __file__] + sys.argv[1:], check=True)
            sys.exit(0)
        return
    print("[build] 首次运行，创建虚拟环境 ...")
    subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)
    print("[build] 安装依赖（pyyaml + markdown）...")
    subprocess.run([str(PIP), "install", "pyyaml", "markdown"], check=True)
    print("[build] 依赖安装完成，重新启动构建 ...")
    subprocess.run([str(VENV_PY), __file__] + sys.argv[1:], check=True)
    sys.exit(0)


def _ensure_deps():
    try:
        import yaml  # noqa: F401
        import markdown  # noqa: F401
    except ImportError:
        _ensure_venv()
        import yaml  # noqa: F401
        import markdown  # noqa: F401


# ── frontmatter 解析 ──────────────────────────

def parse_frontmatter(text):
    """解析 YAML 前端元数据（简化版，支持列表换行格式）。"""
    if not text.startswith("---"):
        return None, "缺少 frontmatter（必须以 --- 开头）"
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None, "frontmatter 格式不完整"

    import yaml
    meta = yaml.safe_load(parts[1]) or {}
    body = parts[2].strip()
    return meta, body


# ── 卡片解析 ──────────────────────────────────

def parse_card(path: Path):
    text = path.read_text(encoding="utf-8")
    meta, body = parse_frontmatter(text)
    if meta is None:
        return None, body

    missing = [f for f in REQUIRED_FIELDS if f not in meta]
    if missing:
        return None, f"缺少字段: {', '.join(missing)}"

    slug = meta["slug"]
    if not slug or not re.match(r"^[a-z0-9][a-z0-9-]*$", slug):
        return None, f"slug 格式不合法: {slug!r}（需英文小写连字符格式）"

    # 确保 tags 是列表
    if isinstance(meta.get("tags"), str):
        meta["tags"] = [meta["tags"]]
    meta.setdefault("tags", [])

    meta["file"] = path.name
    meta["body"] = body
    return meta, None


# ── URL / wiki-link / 图片 ────────────────────

def build_url(meta, base):
    date = str(meta["date"])[:10]
    return f"{base}/notes/{date}-{meta['slug']}.html"


def protect_code(body_md):
    """把代码块/行内代码用占位符保护起来，避免被后续转换误伤。"""
    placeholders = {}
    def repl(m):
        idx = len(placeholders)
        key = f"\x00CODE{idx}\x00"
        placeholders[key] = m.group(0)
        return key
    body = re.sub(r"```.*?```", repl, body_md, flags=re.S)
    body = re.sub(r"`[^`\n]+`", repl, body)
    return body, placeholders


def restore_code(body_md, placeholders):
    for key, val in placeholders.items():
        body_md = body_md.replace(key, val)
    return body_md


def convert_wiki_links(body_md, name_to_url):
    warnings = []
    def repl(m):
        raw = m.group(1).strip()
        target, _, label = raw.partition("|")
        target = target.strip().strip("#").strip()
        label = (label or target).strip()
        url = name_to_url.get(target)
        if url:
            return f"[{label}]({url})"
        warnings.append(f"找不到 wiki-link 目标: {target!r}")
        return f"[{label}](#)"
    md = WIKI_LINK_RE.sub(repl, body_md)
    return md, warnings


def fix_image_paths(content_html, base):
    def repl(m):
        return f'src="{base}/notes/attachments/{m.group(1)}"'
    return re.sub(r'src="(?:\./)?attachments/([^"]+)"', repl, content_html)


# ── 页面生成 ──────────────────────────────────

def gen_note_page(meta, content_html, base):
    date = str(meta["date"])[:10]
    tags = "".join(f'<span>{html.escape(str(t))}</span>' for t in meta["tags"])
    title = html.escape(meta["title"])
    summary = html.escape(meta.get("summary", ""))

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} · CTZ's Flash Garden</title>
  <meta name="description" content="{summary}">
  <base href="{base}/">
  <link rel="stylesheet" href="../assets/garden.css">
</head>
<body>
  <article class="note-page">
    <a class="back-link" href="../index.html">← 返回花园</a>
    <h1 class="note-title">{title}</h1>
    <p class="note-meta">{date}<span class="note-tags">{tags}</span></p>
    <div class="note-content">{content_html}</div>
  </article>
</body>
</html>"""


def gen_sitemap(urls):
    today = datetime.now().strftime("%Y-%m-%d")
    items = "".join(f"  <url><loc>{u}</loc><lastmod>{today}</lastmod></url>\n" for u in urls)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{items}</urlset>"""


def log(msg):
    print(f"[build] {msg}")


# ── 主流程 ──────────────────────────────────

def main():
    _ensure_deps()
    import markdown

    parser = argparse.ArgumentParser(description="CTZ's Flash Garden 构建脚本")
    parser.add_argument("--base", default="", help="部署基础路径，如 /ctz-flash（默认空=站点根）")
    parser.add_argument("--out", default="dist", help="输出目录（默认 dist）")
    args = parser.parse_args()

    base = args.base.rstrip("/")
    out_dir = ROOT / args.out

    # 扫描卡片
    log("扫描卡片...")
    cards = []
    errors = []
    for path in sorted(NOTES_DIR.glob("*.md")):
        meta, err = parse_card(path)
        if err:
            errors.append(f"{path.name}: {err}")
            continue
        cards.append(meta)
        log(f"  ✓ {path.name}")

    if errors:
        print("\n构建失败，以下卡片有问题：")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)

    if not cards:
        log("⚠ 没有找到卡片（notes/ 目录为空）")
        sys.exit(0)

    # 文件名 → URL 映射表（用于 wiki-link 转换）
    name_to_url = {m["file"][:-3]: build_url(m, base) for m in cards}

    # 渲染正文
    md = markdown.Markdown(extensions=["fenced_code", "tables"])
    for m in cards:
        body_protected, ph = protect_code(m["body"])
        body_md, warns = convert_wiki_links(body_protected, name_to_url)
        body_md = restore_code(body_md, ph)
        for w in warns:
            log(f"  ⚠ {m['file']}: {w}")
        content_html = md.reset().convert(body_md)
        content_html = fix_image_paths(content_html, base)
        m["content_html"] = content_html
        m["url"] = build_url(m, base)

        # 收集出链（用于关系图谱；基于保护后的正文，避免代码块误判）
        links = []
        for mm in WIKI_LINK_RE.finditer(body_protected):
            raw = mm.group(1).strip()
            target = raw.partition("|")[0].strip().strip("#").strip()
            url = name_to_url.get(target)
            if url and url != m["url"]:
                links.append(url)
        m["links"] = links

    # 清理输出目录
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    # 复制静态资源
    shutil.copytree(ASSETS_DIR, out_dir / "assets")
    shutil.copy(INDEX_SRC, out_dir / "index.html")
    if ATTACH_DIR.exists() and any(ATTACH_DIR.iterdir()):
        shutil.copytree(ATTACH_DIR, out_dir / "notes" / "attachments")
    else:
        (out_dir / "notes" / "attachments").mkdir(parents=True)

    # 替换 index.html 的 base 占位符
    index_path = out_dir / "index.html"
    index_html = index_path.read_text(encoding="utf-8")
    index_html = index_html.replace("{{BASE}}", base + "/")
    index_path.write_text(index_html, encoding="utf-8")

    # manifest.json
    manifest = {
        "cards": [
            {
                "file": m["file"],
                "title": m["title"],
                "date": str(m["date"])[:10],
                "tags": m["tags"],
                "summary": m["summary"],
                "url": m["url"],
                "links": m["links"],
                "content_html": m["content_html"],
            }
            for m in cards
        ]
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 独立卡片页
    notes_out = out_dir / "notes"
    notes_out.mkdir(exist_ok=True)
    urls = [base + "/" if base else "/"]
    for m in cards:
        page = gen_note_page(m, m["content_html"], base)
        filename = Path(m["url"]).name
        (notes_out / filename).write_text(page, encoding="utf-8")
        urls.append(m["url"])

    # sitemap.xml
    (out_dir / "sitemap.xml").write_text(gen_sitemap(urls), encoding="utf-8")

    log(f"完成！共 {len(cards)} 张卡片 → {args.out}/")
    log(f"本地预览: python3 -m http.server 8080 --directory {args.out}")


if __name__ == "__main__":
    main()