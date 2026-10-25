# 薪火（Xinhuo · ICH）

非遗传统技艺数字化展示与学习平台。规格见 GitHub Issue [#1](https://github.com/imyifeng/xinhuo-ich/issues/1)，领域术语以根目录 [GLOSSARY.md](GLOSSARY.md) 为准，架构决策见 [docs/adr/](docs/adr/)。

## 技术栈

- **Nuxt 4**（Vue 3 + TypeScript）单体全栈，分层为 server/api（接入）→ server/utils/services（业务）→ Prisma（数据访问），见 ADR 0002
- **PostgreSQL 18** + **Prisma 7**（driver adapter：`@prisma/adapter-pg`）
- **Redis 8**（ioredis，`server/utils/redis.ts` 封装为可复用服务模块）
- **Tailwind CSS 4**、**vitest + @nuxt/test-utils**（HTTP API 集成测试，接缝 1）

版本钉死：Node `>= 26.12.1`（见 `.node-version`）+ pnpm `12.15.0`（见 `packageManager` 字段）+ 精确依赖版本（`pnpm-lock.yaml` 入库）。

## 环境要求

- Node.js >= 26.12.1、pnpm >= 12.15.0（`corepack enable` 或独立安装）
- Docker（含 compose）

## 快速开始（开发）

```bash
# 1. 环境变量：复制模板为 .env（默认值即可直接使用）
cp .env.example .env

# 2. 启动基础设施（仅 PostgreSQL + Redis，应用在宿主机热载）
docker compose -f compose.dev.yaml up -d

# 3. 安装依赖（postinstall 会自动 prisma generate + nuxt prepare）
pnpm install

# 4. 建库 + 种子数据
pnpm db:migrate   # 开发期建表/改表（prisma migrate dev）
pnpm db:seed      # 写入演示用技艺条目、5 门已发布课程与演示账号（见下）

# 5. 启动应用（热载）
pnpm dev          # http://localhost:3000
```

打开 http://localhost:3000：首页展示品牌与来自数据库的实时统计（技艺条目数 / 覆盖子类别数）；`GET /api/health` 返回数据库与 Redis 连通状态及详情缓存统计（命中/未命中计数）。技艺条目详情接口带 cache-aside 缓存（`X-Cache: HIT | MISS | BYPASS` 响应头），实现见 `server/utils/services/cache.service.ts`。管理后台在 http://localhost:3000/admin（需用演示管理员或被标记为管理员角色的账号登录），后台写路径已接线 `invalidateCraftItem` 失效详情缓存。

### 演示账号（仅开发/演示，种子幂等 upsert）

| 角色 | 用户名 | 密码 | 用途 |
| --- | --- | --- | --- |
| 管理员 | `admin` | `admin12345` | /admin 管理后台（技艺条目、课程审核、账号等） |
| 传承人 | `inheritor` | `inheritor12345` | /studio 创作中心，5 门演示课程的作者 |

课程与学习进度（工单 #6）：`/courses` 浏览已发布课程（5 门演示课程挂在陶瓷/织绣/造纸印刷/金属加工/酿造各一个条目下）；条目详情页有「相关课程」区；传承人在 `/studio` 建课、编排步骤、提交审核；管理员在 `/admin/courses` 发布/驳回；学习者登录后在课程页标记步骤完成并查看进度（进度 = 已完成步骤数 / 总步骤数，开始课程与完成步骤分别落 `behavior_event` 的 `START_COURSE` / `COMPLETE_STEP`）。

## 测试

```bash
# 需要先起开发基础设施（postgres + redis）
docker compose -f compose.dev.yaml up -d
pnpm test
```

- 每次运行 `pnpm test` 时，`tests/global-setup.ts` 会**创建（如缺失）并强制重置测试专用数据库**（`xinhuo_test`，与开发库同实例），再起真实 Nitro 服务跑 HTTP 集成测试。
- 测试库连接串经 `TEST_DATABASE_URL` 注入（见 `.env.example`），`DATABASE_URL` 在测试运行期间被指向测试库，应用代码无需感知。
- 测试只断言外部行为（请求进 → 响应出），数据库状态通过 Prisma 作为夹具准备，符合规格 #1 的接缝 1 约定。

## 生产部署

```bash
cp .env.example .env        # 按需修改 APP_PORT / POSTGRES_* 等
docker compose up -d --build
```

- 三个服务：app（多阶段构建镜像）+ postgres + redis，均带 healthcheck，数据落命名卷。
- app 启动时自动执行 `prisma migrate deploy`；生产库默认为空（种子数据仅用于开发/演示），首页计数从 0 开始随内容增长。
- 应用暴露宿主机 `${APP_PORT}`（默认 3000），由宿主机既有 Caddy 反代，compose 内不含反向代理（ADR 0002）。
- 改 `APP_PORT` 后 `docker compose up -d app` 即可在新端口生效。

## 环境变量（.env）

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `DATABASE_URL` | 应用连接的 PostgreSQL（开发指向宿主机映射端口） | `postgresql://xinhuo:xinhuo@localhost:5433/xinhuo` |
| `TEST_DATABASE_URL` | 集成测试专用库（每次 `pnpm test` 强制重置） | `postgresql://xinhuo:xinhuo@localhost:5433/xinhuo_test` |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6380` |
| `CACHE_ENABLED` | 详情缓存开关（默认开；`false`/`0` 关闭用于压测对比，`X-Cache: BYPASS`） | `true` |
| `POSTGRES_PORT` / `REDIS_PORT` | compose 映射到宿主机的端口 | `5433` / `6380` |
| `APP_PORT` | 生产 app 暴露的宿主机端口（Caddy 指向此处） | `3000` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | PostgreSQL 容器初始化 | `xinhuo` / `xinhuo` / `xinhuo` |

注意：生产 compose 内部服务间使用容器网络地址（`postgres:5432` / `redis:6379`），由 compose 文件负责拼接，无需在 `.env` 中配置。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 开发服务器（热载） |
| `pnpm build` / `pnpm preview` | 生产构建 / 本地预览构建产物 |
| `pnpm test` | 集成测试（自动重置测试库） |
| `pnpm db:migrate` | 开发期迁移（prisma migrate dev） |
| `pnpm db:seed` | 写入演示种子数据 |
| `pnpm exec prisma studio` | 数据库可视化管理 |

## 目录结构（与报告 5.2 工程结构对应）

```
app/                     # 前端（Vue 页面，Tailwind）
server/
  api/                   # 接入层：HTTP 端点（auth、craft-items、courses、studio、admin 等）
  utils/services/        # 业务层：认证、条目、课程、学习进度、缓存等服务
  utils/session.ts       # 会话契约（Redis 会话，跨工单共享）
  utils/prisma.ts        # 数据访问层：Prisma 客户端单例
  utils/redis.ts         # 基础设施：Redis 客户端单例
prisma/                  # schema、迁移、种子数据
tests/api/               # 接缝 1：HTTP API 集成测试
Dockerfile / compose.yaml        # 生产形态
compose.dev.yaml                 # 开发基础设施
```
