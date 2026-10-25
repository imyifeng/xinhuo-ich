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

# （可选）写入演示行为数据：合成行为事件 + 画像/推荐重建，
# 让「为你推荐」、画像标签与管理端画像统计开箱即有内容
pnpm demo:seed
```

打开 http://localhost:3000：首页展示品牌与来自数据库的实时统计（技艺条目数 / 覆盖子类别数）；`GET /api/health` 返回数据库与 Redis 连通状态及详情缓存统计（命中/未命中计数）。技艺条目详情接口带 cache-aside 缓存（`X-Cache: HIT | MISS | BYPASS` 响应头），实现见 `server/utils/services/cache.service.ts`。交流区在 http://localhost:3000/community（帖子列表与详情公开可看，发帖/评论需登录）。管理后台在 http://localhost:3000/admin（需用演示管理员或被标记为管理员角色的账号登录），后台写路径已接线 `invalidateCraftItem` 失效详情缓存，内容审核（帖子/评论下架与恢复）见「内容审核」页。

### 演示账号（仅开发/演示，幂等 upsert；凭据不得用于真实运营）

| 账号 | 密码 | 角色 | 演示视角 |
| --- | --- | --- | --- |
| `admin` | `admin12345` | 管理员 | /admin 管理后台（条目、课程审核、账号、画像统计与重建） |
| `inheritor` | `inheritor12345` | 传承人 | /studio 创作中心，5 门演示课程的作者 |
| `taotao` | `taotao123456` | 学习者 | 陶瓷爱好者型，交流区制瓷心得帖主 |
| `yaoyao` | `yaoyao123456` | 学习者 | 陶瓷爱好者型 |
| `shanshan` | `shanshan123456` | 学习者 | 织绣爱好者型，交流区织绣心得帖主 |
| `xiuxiu` | `xiuxiu123456` | 学习者 | 织绣爱好者型 |
| `muzi` | `muzi123456` | 学习者 | 造纸印刷爱好者型，交流区造纸心得帖主 |
| `momo` | `momo123456` | 学习者 | 造纸印刷爱好者型 |
| `jiujiu` | `jiujiu123456` | 学习者 | 酿造爱好者型 |
| `ququ` | `ququ123456` | 学习者 | 酿造爱好者型 |
| `xiaotie` | `xiaotie123456` | 学习者 | 金属加工爱好者型 |
| `dingding` | `dingding123456` | 学习者 | 金属加工爱好者型 |

- `admin` / `inheritor` / `taotao` / `shanshan` / `muzi` 由 `db:seed` 写入（含演示帖子与评论）；其余学习者与全部演示行为数据由 `demo:seed` 写入。
- `demo:seed`（工单 #10）：在内容种子之上为 10 名演示学习者合成近两周的五类行为事件（每人约 40 条，偏好差异化——如陶瓷型学习者七成浏览落在陶瓷条目并完整学完陶瓷课程），随后调用与管理端「手动触发」相同的画像重建入口，保证画像标签（如「陶瓷爱好者型」）与「为你推荐」非空。幂等（先清后造，重复执行不翻倍）；副作用：演示账号两次执行之间产生的真实行为事件会在下次执行时被覆盖——演示数据以脚本为准。

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

## 报告素材包（docs/report-assets/）

写课程实践报告（第 4/5/6 章）直接取用的素材集合，索引与按章节取用指南见
[docs/report-assets/README.md](docs/report-assets/README.md)：

| 素材 | 位置 | 对应报告章节 |
| --- | --- | --- |
| Postman 接口集合（27 请求 / 52 断言，newman 全绿） | `docs/report-assets/postman/` | 第 6 章 · 接口测试 |
| 测试用例及结果汇总（27 文件 / 172 用例全通过） | `docs/report-assets/testing/` | 第 6 章 · 测试用例及结果 |
| 压测结果整理（引用表 + 结论段 + 开/关缓存对比图） | `docs/report-assets/perf/`（原始数据在 `docs/perf/`） | 第 6 章 · 性能测试 |
| 界面截图 17 张（对应 5.1 章图位清单） | `docs/report-assets/screenshots/` | 5.1 章界面展示 |
| ER 图（mermaid 源码 + SVG/PNG）与数据字典（4.6.1/4.6.2） | `docs/report-assets/database/` | 4.6 章数据库设计 |

## 生产部署（宿主机 Caddy 反代 · runbook）

架构（ADR 0002）：compose 只含 app（多阶段构建镜像）+ postgres + redis 三个服务，应用暴露宿主机 `${APP_PORT}`，由宿主机**既有** Caddy 反代并承担 HTTPS；compose 内不含反向代理，postgres/redis 也不映射宿主机端口，仅容器网络内可达。

### 1. 环境要求

- 服务器：1 核 2G 起步即可（演示规格），已安装 Docker（含 compose 插件），且**已有 Caddy 在跑**（其他服务共用）
- 一个解析到服务器 IP 的域名（Caddy 自动签发/续期 HTTPS 证书）

### 2. 获取代码

```bash
git clone https://github.com/imyifeng/xinhuo-ich.git && cd xinhuo-ich   # 推荐，升级即 git pull
```

（备选：本地 `docker build -t xinhuo-ich:latest .` 后 `docker save` 打包 scp 上服务器 `docker load`，仓库仍需上传 `compose.yaml` 与 `.env`。）

### 3. 配置 .env（生产值建议）

```bash
cp .env.example .env
```

| 变量 | 生产建议 |
| --- | --- |
| `POSTGRES_PASSWORD` | **必须改**：`openssl rand -base64 24` 生成长随机密码（库不暴露宿主机端口，但仍勿用默认弱密码） |
| `APP_PORT` | 应用暴露端口，默认 `3000`；与其他服务冲突就改（如 `3005`），Caddy 指向同一端口即可 |
| `POSTGRES_USER` / `POSTGRES_DB` | 一般保持默认 `xinhuo` |
| `DATABASE_URL` / `REDIS_URL` | **无需配置**：生产 compose 内部使用容器网络地址（`postgres:5432` / `redis:6379`）自动拼接 |

### 4. 首次启动

```bash
docker compose up -d --build
docker compose ps                 # 等 app 状态变 healthy（首建约 1~2 分钟）
curl http://127.0.0.1:${APP_PORT}/api/health   # {"status":"ok","checks":{"database":"up","redis":"up"},...}
```

app 容器入口（`docker/entrypoint.sh`）启动时自动执行 `prisma migrate deploy`，无需手工迁移；改 `APP_PORT` 后 `docker compose up -d app` 在新端口生效。

### 5. 演示数据（可选，正式运营可跳过）

生产库默认为空（首页计数从 0 开始随内容增长）。要开箱即有完整演示效果（28 项技艺条目、5 门课程、交流区帖子、演示账号、行为事件、画像与推荐）：

```bash
docker compose run --rm seed
```

- 该一次性任务复用应用镜像的 build 构建层（缓存共享，不额外构建），跑完即退出；
- 幂等，可重复执行；演示账号见上文「演示账号」，跑完即可用演示学习者登录看「为你推荐」与画像标签。

### 6. Caddy 反代（公网可访问的最后一步）

把 [docs/deploy/caddy.example](docs/deploy/caddy.example) 的站点块并入服务器既有 Caddyfile（域名与端口改成你的），然后：

```bash
systemctl reload caddy
```

打开 `https://你的域名` 即为公网可访问的平台门户。

### 7. 升级

```bash
cd xinhuo-ich && git pull
docker compose up -d --build      # app 启动时自动 migrate deploy，数据在卷中不受影响
```

回滚：`git checkout <上一个提交>` 后重新 `docker compose up -d --build`。

### 8. 备份（pg 卷）

```bash
# 手动备份（数据都在命名卷 postgres_data）
docker compose exec postgres pg_dump -U xinhuo xinhuo | gzip > xinhuo-$(date +%F).sql.gz
# 恢复
gunzip -c xinhuo-2026-01-01.sql.gz | docker compose exec -T postgres psql -U xinhuo xinhuo
```

建议 crontab 每日一备并保留最近 7 天：

```cron
0 4 * * * cd /path/to/xinhuo-ich && docker compose exec postgres pg_dump -U xinhuo xinhuo | gzip > /var/backups/xinhuo-$(date +\%F).sql.gz && find /var/backups -name 'xinhuo-*.sql.gz' -mtime +7 -delete
```

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
| `pnpm db:seed` | 写入内容种子（条目/课程/演示账号/帖子） |
| `pnpm demo:seed` | 演示数据管道：内容种子 + 合成行为事件 + 画像/推荐重建（幂等） |
| `docker compose run --rm seed` | 生产容器内跑 `demo:seed`（一次性任务，见部署 runbook） |
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
