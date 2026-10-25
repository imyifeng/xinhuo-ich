# 报告素材包（工单 #11 · T10）

为课程实践报告（模板第 4/5/6 章）准备的直接取用素材集合。所有产物都有验证记录
（newman 全绿、全量测试真实输出、ER 图渲染成功、截图实拍），来源与再生成方式见各子目录 README。

## 素材总索引

| 目录 | 内容 | 对应报告章节 | 验证方式 |
| --- | --- | --- | --- |
| [`postman/`](postman/) | Postman 接口集合（27 请求 / 52 断言，覆盖主要接口）+ newman 运行摘要 | 第 6 章 · 接口（黑盒）测试 | `npx newman run` 全量执行：**27 请求 / 52 断言 / 0 失败**（newman 6.2.3） |
| [`perf/`](perf/) | 压测结果整理：引用表 + 结论段 + 开/关缓存对比图（`comparison.svg/png`） | 第 6 章 · 性能测试 | 数据取自 `docs/perf/results/*.summary.json`（工单 #9 归档）；图表脚本 `chart.mjs` 可重生成 |
| [`screenshots/`](screenshots/) | **17 张**真实浏览器截图 + 图位清单 | 5.1 章系统界面展示 | browser-use 实拍（1440×900），demo:seed 演示数据，清单标注每张图的角色与要点 |
| [`database/`](database/) | ER 图（`erd.mmd` 源码 + 渲染 `erd.svg/png`）+ 数据字典（4.6.1 实体表 / 4.6.2 索引设计） | 4.6 章数据库设计 | `generate.mjs` 从 `prisma/schema.prisma` 单一来源生成；mermaid-cli docker 渲染成功 |
| [`testing/`](testing/) | 测试用例及结果汇总（模块/文件/用例/结果/耗时） | 第 6 章 · 测试用例及结果 | `pnpm test` 全量真实运行：**27 文件 / 172 用例全部通过**，vitest JSON 报告归档备查 |

## 按报告章节取用

- **第 4 章（系统设计）**
  - 4.6 数据库设计 → `database/erd.svg`（ER 图插页）、`database/data-dictionary.md`（4.6.1 实体表、4.6.2 索引设计逐表素材）
  - 4.x 工程结构 → 仓库根 README「目录结构」节
- **第 5 章（系统实现）**
  - 5.1 界面展示 → `screenshots/`（清单见其 README，17 张已对应图位）
- **第 6 章（系统测试）**
  - 6.x 功能/接口测试 → `postman/`（集合导入 Postman 演示或直接引用 `newman-run-summary.json` 数据）、`testing/test-summary.md`（172 条用例明细）
  - 6.x 性能测试 → `perf/README.md`（引用表 + 结论段可直接改写）+ `perf/comparison.svg`（对比图）

## 快速复验（换机器跑一遍）

```bash
# 0. 环境准备（postgres 5433 / redis 6380 在跑的前提下）
cp .env.example .env && docker compose -f compose.dev.yaml up -d
pnpm install && pnpm db:migrate && pnpm demo:seed && pnpm dev   # http://localhost:3000

# 1. 接口集合
npx newman run docs/report-assets/postman/xinhuo-api.postman_collection.json

# 2. 全量测试
pnpm test

# 3. ER 图 / 数据字典 / 对比图重生成
node docs/report-assets/database/generate.mjs
node docs/report-assets/perf/chart.mjs
```

## 生成物与原始数据的边界

- `postman/`、`screenshots/`、`perf/comparison.*`、`database/erd.*`、`testing/` 为本工单产物；
- JMeter 原始脚本与逐请求结果（`.jmx` / `.jtl.gz` / `summarize.mjs`）在 [`docs/perf/`](../perf/)，本目录只做整理与索引，不重复归档；
- 数据库结构唯一来源是 [`prisma/schema.prisma`](../../prisma/schema.prisma)——改 schema 后重跑
  `node docs/report-assets/database/generate.mjs` 即可同步 ER 图与数据字典。
