# 0002 - 技术栈与部署形态：Nuxt 单体全栈 + 宿主 Caddy 反代

课设模板参考栈是 Java/Spring Boot，但实际开发只有一人且更熟 TypeScript/Vue，遂定为 Nuxt 4 单体全栈（Vue 3 + TS + Nitro server routes），Prisma + PostgreSQL，Redis 承担会话、热点缓存与画像中间数据；前台 Tailwind 手写，后台 Element Plus。分层叙事：server/api（接入）→ server/utils services（业务）→ Prisma（数据访问），对应报告模板的三层架构。

部署复用宿主机既有 Caddy：docker compose 只含 app（多阶段构建镜像）+ postgres + redis，应用映射到本机端口由 Caddy 反代，compose 内不放反向代理；开发期 compose 只跑 postgres/redis，应用在宿主机热载开发。

## Considered Options

- TS 前端 + Go 后端：单人 5 天双语言、双构建链、联调成本，否决
- Vue SPA + NestJS：结构最像 Spring Boot，但两个仓库不如单体省心，否决
- MySQL：为对齐报告模板而备选；选 PostgreSQL 出于偏好，Prisma 下无成本差异，ER 图可用 prisma-erd-generator 从 schema 生成
