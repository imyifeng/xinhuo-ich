# 测试用例及结果汇总（报告第 6 章素材）

对应报告第 6 章「测试用例及结果」。数据为**一次真实全量测试运行**的输出，非手工整理。

## 文件

| 文件 | 说明 |
| --- | --- |
| `test-summary.md` | 全部 172 条用例的明细表（模块 / 文件 / 用例名 / 结果 / 耗时），按工单主题分组，可直接作为报告表格底稿 |
| `vitest-run.json` | 当次运行的 vitest JSON 报告（机器可核对的原始终据） |

## 当次运行结果

| 项 | 值 |
| --- | --- |
| 运行日期 | 2026-10-25（本 worktree，基点 spec/1-xinhuo-platform@b72d7d1） |
| 命令 | `pnpm test`（即 `vitest run`） |
| 结果 | **27 个测试文件 / 172 条测试用例，全部通过（0 失败 / 0 跳过）** |
| 总时长 | 约 228 s（其中测试 99%、导入 1%） |
| 测试形态 | HTTP API 集成测试（`@nuxt/test-utils` 起**真实 Nitro 服务**发真实 HTTP 请求，见 ADR 0002 接缝 1）+ 推荐算法单元测试（TF-IDF / K-Means / 特征向量） |
| 测试数据库 | `xinhuo_test_t10`（每次运行由 `tests/global-setup.ts` 强制重置，与开发库同实例隔离） |

## 复现

```bash
# 需要先起基础设施（postgres 5433 + redis 6380）
docker compose -f compose.dev.yaml up -d

# 全量测试（global-setup 自动建库/重置测试库，DATABASE_URL 运行期间指向测试库）
pnpm test

# 取 JSON 报告（与 test-summary.md 同源）
pnpm vitest run --reporter=default --reporter=json --outputFile=vitest-run.json
```

## 用例分布（按模块，明细见 test-summary.md）

| 模块 | 测试文件 | 覆盖内容 |
| --- | --- | --- |
| HTTP API · 基础接口 | health / stats | 健康检查、平台统计 |
| HTTP API · 认证（#2） | auth | 注册校验、argon2 落库、登录会话（Redis 契约）、登出全链路 |
| HTTP API · 技艺条目（#3） | craft-items（列表/详情/行为事件） | 列表筛选分页、详情字段、VIEW_ITEM 事件 |
| HTTP API · 条目与缓存（#3/#9） | craft-items.cache / cache-bypass | X-Cache HIT/MISS、失效、BYPASS 开关 |
| HTTP API · 管理端（#4/#5） | admin/* | 角色守卫、条目 CRUD、传承人、标签、内容审核、账号 |
| HTTP API · 课程与学习进度（#6） | courses.* | 公开列表详情、studio 建课编排、审核流、开始/完成步骤幂等 |
| HTTP API · 交流区（#7） | posts.* | 列表详情、发帖评论校验、下架不可见性 |
| HTTP API · 画像与推荐（#8） | recommendations | 401 守卫、画像标签与推荐兜底 |
| 单元测试 · 推荐算法（#8） | unit/recommendation/* | TF-IDF、K-Means、特征向量 |
| 演示数据管道（#10） | demo-seed | 首跑就位与重跑幂等 |
