# CTZ's Flash Garden

CTZ 的轻量数字花园。一个 Obsidian 仓库即内容源，一个 python 脚本即构建工具。

## 快速开始

```bash
# 安装依赖
pip3 install markdown

# 构建
python3 build.py

# 本地预览
python3 -m http.server 8080 --directory dist
```

## 加卡片

1. 在 `notes/` 下新建 `.md` 文件
2. 填写 frontmatter（title / date / tags / summary / slug 必填）
3. 正文支持 Obsidian 语法（`[[wiki-link]]`、图片、粗体、列表等）
4. 图片放 `notes/attachments/`，正文用 `![说明](attachments/xxx.png)`
5. 运行 `python3 build.py` 更新站点
6. 预览确认，`git add/commit/push` 部署

## 约定

- **slug 必填**：英文小写连字符格式，用于线上 URL；缺失则构建报错
- **文件名自由**：Obsidian 内怎么写都行，不影响线上
- **wiki-link**：`[[卡片名]]` 或 `[[卡片名|显示文字]]`，构建时自动转为指向对应卡片页的链接

## 部署

起步：手动推 gh-pages 分支；后续升级 GitHub Actions 自动构建。