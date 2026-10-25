# ER 图与数据字典（数据库设计素材）

对应报告 4.6 节「数据库设计」：ER 图（4.6 概览）与数据字典（4.6.1 实体表设计 / 4.6.2 索引设计）。
全部产物由 `generate.mjs` 从 `prisma/schema.prisma` 单一来源自动生成，schema 改动后重跑即可同步。

## 文件

| 文件 | 说明 |
| --- | --- |
| `generate.mjs` | 生成器脚本（Node 标准库，零依赖）：解析 Prisma schema → 输出 `erd.mmd` 与 `data-dictionary.md` |
| `erd.mmd` | Mermaid `erDiagram` 源码（13 张实体表、外键关系、虚线标注的多态引用） |
| `erd.svg` | erd.mmd 渲染结果（矢量，浏览器直接打开；文字可搜索/复制） |
| `erd.png` | erd.svg 的 2x 位图版（报告/文档插图用） |
| `data-dictionary.md` | 数据字典：每张表的中文表名、描述、字段列表（列名 / Prisma 字段 / PG 类型 / 约束 / 说明）、索引与唯一约束、枚举类型、索引设计汇总 |

## 再生成

```bash
# 1. 重新生成 mermaid 源码与数据字典（在仓库根目录执行）
node docs/report-assets/database/generate.mjs

# 2. 渲染 SVG / PNG（mermaid-cli docker 化运行，无需本机 Java/Node 图形环境）
cd docs/report-assets/database
echo '{"executablePath":"/usr/bin/chromium","args":["--no-sandbox","--disable-setuid-sandbox","--disable-gpu"]}' > /tmp/pptr.json
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/data -v /tmp/pptr.json:/pptr.json \
  minlag/mermaid-cli -p /pptr.json -i /data/erd.mmd -o /data/erd.svg -b white
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/data -v /tmp/pptr.json:/pptr.json \
  minlag/mermaid-cli -p /pptr.json -i /data/erd.mmd -o /data/erd.png -b white -s 2
```

说明：

- `minlag/mermaid-cli` 镜像入口即 `mmdc`；`-p` 传入 puppeteer 配置（镜像内已有系统 chromium，
  以 `executablePath` 指定并加 `--no-sandbox`）；`--user` 取宿主机 uid 避免挂载目录写不进。
- 若无法使用 docker，可保留 `erd.mmd` 源码，用任何 Mermaid 渲染器（如 VS Code 插件、
  GitHub 原生渲染 markdown 代码块）查看；仓库同时归档了渲染好的 `erd.svg` / `erd.png`。

## 生成口径备注

- 字段「说明」取自 schema 的 `///` 文档注释；少数无注释字段由 `generate.mjs` 内的
  `FIELD_NOTES` 映射补充（schema 注释优先）。
- 表的中文名在 `CHINESE` 映射中维护；表描述即 schema 中模型上方的 `///` 注释。
- 类型列给出 Prisma 字段映射到 PostgreSQL 之后的实际类型（如 `String → text`、
  `Json → jsonb`、枚举 → `enum XxxStatus`）；ER 图框内为简化名（`datetime` 等），以数据字典为准。
- `behavior_event.target_id` 与 `recommendation.craft_item_id / course_id` 为多态目标
  （不设数据库外键，读取时联表过滤），ER 图中以虚线表达，与实体外键实线区分。
