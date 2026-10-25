# Postman 接口集合（黑盒测试素材）

对应报告第 6 章「系统测试」接口测试小节。覆盖薪火平台主要接口共 **27 个请求 / 52 条断言**，
含中文说明、示例请求体与可重复执行的测试脚本。

## 文件

| 文件 | 说明 |
| --- | --- |
| `xinhuo-api.postman_collection.json` | Postman Collection v2.1 集合（手写，可直接导入 Postman 或用 newman 运行） |
| `newman-run-summary.json` | 全量运行摘要（newman 6.2.3，27 请求 / 52 断言 / 0 失败），由 JSON 导出提炼 |

## 覆盖范围

| 分组 | 接口 |
| --- | --- |
| 基础接口（公开） | `GET /api/health`、`GET /api/stats` |
| 认证与账号 | `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`（登出见末组） |
| 技艺条目 | 列表、按子类别筛选、详情（观察 `X-Cache: HIT\|MISS` 响应头） |
| 课程与学习进度 | 课程列表、详情（登录态含步骤全文与进度）、开始课程、标记步骤完成、我的课程进度 |
| 交流区 | 帖子列表、详情、发帖、评论 |
| 个性化推荐 | `GET /api/recommendations`（画像标签 + 推荐条目 + 理由） |
| 管理端 | 管理员登录、条目列表（管理视角）、创建条目 → 删除条目（CRUD 一例，自清理）、下架演示帖（内容审核一例）、画像统计、手动画像重建 |
| 认证收尾 | 登出 + 负向用例（登出后访问受保护接口预期 401） |

## 会话（Cookie）使用说明

认证为自实现会话：服务端下发 **httpOnly Cookie `xinhuo_session`**，后续请求以请求头
`Cookie: xinhuo_session=<token>` 携带。集合不需要手工复制 Cookie：

- 「认证与账号 → 登录（学习者 taotao）」的测试脚本自动把 token 写入集合变量 `{{session_cookie}}`；
- 「管理端 → 登录（管理员 admin）」同理写入 `{{admin_cookie}}`（两套会话互不干扰）；
- 所有需登录态的请求已在请求头预置 `Cookie: xinhuo_session={{session_cookie}}`（或 `{{admin_cookie}}`），
  **在 Postman 中从上到下依次执行**即可全程保持登录态。
- 登出会销毁会话，因此安排在集合最后一组，末尾附一条「登出后访问预期 401」的负向用例。

ID 链式传递同理：列表请求脚本把首个条目/课程/帖子 ID 写入 `{{craft_item_id}}` / `{{course_id}}` /
`{{step_id}}` / `{{post_id}}`；「发帖」把新帖 ID 写入 `{{created_post_id}}` 供管理端下架演示。
种子数据的 cuid 每个环境不同，集合不写死 ID，换环境直接可跑。

## 运行方式

```bash
# 0. 准备：按仓库 README 起服务（demo:seed 后的演示数据），默认 http://localhost:3000
pnpm dev

# 1. Postman 中导入集合，从上到下依次执行；或命令行整包运行：
npx newman run docs/report-assets/postman/xinhuo-api.postman_collection.json

# 端口不同时覆盖 base_url（示例：本机 3001 端口验证）：
npx newman run docs/report-assets/postman/xinhuo-api.postman_collection.json \
  --env-var "base_url=http://localhost:3001" \
  --reporters cli,json --reporter-json-export /tmp/newman.json
```

## 验证记录（2026-10-25，本机）

- 环境：`pnpm dev`（demo:seed 演示数据：28 条目 / 5 课程 / 7 帖 / 10 学习者画像），被测地址 `http://localhost:3001`
- 工具：newman 6.2.3（npx）
- 结果：**27 请求全部执行、52 断言全部通过、0 失败**，总时长约 0.5 s，平均响应 7 ms（最大 24 ms）
- 明细见 `newman-run-summary.json`（每个请求的方法、URL、响应码与逐条断言结果）

> 注意：写接口会改动演示数据（注册演示用户、发一帖一评、开始课程、下架演示帖）。
> 需要还原纯净演示数据时重跑 `pnpm demo:seed`。
