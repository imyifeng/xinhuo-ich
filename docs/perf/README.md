# 压测归档：技艺条目详情接口 · 开/关缓存对比（工单 #9）

报告第 6 章素材。被测接口为热点路径 `GET /api/craft-items/:id`（ADR 0001 复杂工程问题 2 的靶面）：
Redis cache-aside（命中直返）vs 逐请求回源 PostgreSQL，由 `CACHE_ENABLED` 环境变量切换。

## 结论速览

- **吞吐**：开启缓存为关闭缓存的 **6.8 ~ 7.5 倍**（50 并发 17,829 vs 2,380 req/s）。
- **P95 延迟**：开启缓存稳定在 **4 ~ 17 ms**；关闭缓存随并发线性恶化（**27 → 56 → 113 ms**）。
- 关闭缓存时吞吐钉死在 ~2.1 ~ 2.4k req/s（Prisma/pg 连接池成为瓶颈），并发继续加码只转化为排队延迟——这正是热点条目必须缓存防护的原因。
- 六个场景全部 **0 错误**（响应码断言 200）。

## 测试环境

| 项 | 值 |
| --- | --- |
| 宿主机 | 16 核 / 30 GiB 内存（Linux，与 PostgreSQL 18、Redis 8 容器同机） |
| 应用 | `pnpm build` 生产构建，`node .output/server/index.mjs`（单进程 Nitro） |
| 压测工具 | **Apache JMeter 5.5**（`justb4/jmeter:latest` Docker 镜像，`--network host`；本机无 Java/JVM，故 docker 化运行，工具选型见下） |
| 被测请求 | `GET /api/craft-items/cmvnceqeq0000bj59x6vrt0la`（种子数据已发布条目，响应体约 2.2 KB） |
| 负载模型 | 闭环（closed model）：每线程循环尽力请求；ramp-up 5s，持续 60s；并发梯度 50 / 100 / 200 |
| 场景矩阵 | `CACHE_ENABLED=true`（on）× 3 梯度，`CACHE_ENABLED=false`（off）× 3 梯度，共 6 轮 |
| 断言 | 响应码必须为 200 |

工具选型说明：开发容器内无 Java/JVM，JMeter 以官方社区镜像 `justb4/jmeter`（JMeter 5.5）Docker 化运行，
脚本、结果、日志经 volume 挂载落盘宿主机，满足"JMeter 压测脚本 + 开/关缓存对比"的工单要求，无需替换工具。

## 结果汇总

| 场景 | 并发 | 吞吐（req/s） | 均值 (ms) | P50 (ms) | P90 (ms) | P95 (ms) | P99 (ms) | 错误率 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 缓存开 | 50 | **17,829.4** | 2.7 | 3 | 4 | **4** | 6 | 0% |
| 缓存开 | 100 | **14,498.0** | 6.6 | 6 | 9 | **10** | 12 | 0% |
| 缓存开 | 200 | **16,029.2** | 12.0 | 12 | 16 | **17** | 20 | 0% |
| 缓存关 | 50 | 2,379.9 | 20.1 | 20 | 25 | **27** | 33 | 0% |
| 缓存关 | 100 | 2,126.3 | 45.1 | 45 | 53 | **56** | 67 | 0% |
| 缓存关 | 200 | 2,304.6 | 83.3 | 80 | 102 | **113** | 155 | 0% |

吞吐倍率（开 / 关）：50 并发 **7.5×**，100 并发 **6.8×**，200 并发 **7.0×**。

三条曲线特征：

1. **缓存关**：吞吐不随并发增长（连接池饱和），延迟随并发近线性上升——排队发生在 Prisma 连接池；
2. **缓存开**：吞吐提升一个数量级，延迟随并发缓慢上升（Redis 单键读 + JSON 序列化在事件循环内排队）；
3. 两轮压测均从**冷缓存**开始（无预热）：开缓存场景的首个请求 MISS 回源，
   60s 运行期间 60s TTL（+随机抖动）自然过期一次，由 singleflight 互斥重建——防击穿机制在压测窗口内真实生效。

## 复现步骤

```bash
# 1. 生产构建
pnpm build

# 2. 起被测服务（开缓存 / 关缓存各起一次）
PORT=3737 CACHE_ENABLED=true \
DATABASE_URL=postgresql://xinhuo:xinhuo@localhost:5433/xinhuo_dev_t8 \
REDIS_URL=redis://localhost:6380/4 node .output/server/index.mjs

# 3. 逐梯度压测（重复换 -Jthreads）
cd docs/perf
docker run --rm --network host -v "$PWD":/perf -w /perf justb4/jmeter:latest \
  -n -t /perf/craft-item-detail.jmx -l /perf/results/cache-on-50.jtl -j /perf/results/cache-on-50.log \
  -Jthreads=50 -Jrampup=5 -Jduration=60 \
  -JitemId=cmvnceqeq0000bj59x6vrt0la -Jport=3737

# 4. 汇总（输出同名 .summary.json）
node summarize.mjs results/cache-on-50.jtl [...]
```

## 归档文件

| 文件 | 说明 |
| --- | --- |
| `craft-item-detail.jmx` | JMeter 测试计划（参数化：threads / rampup / duration / host / port / itemId） |
| `summarize.mjs` | JTL → 汇总 JSON 的确定性计算脚本（吞吐 / 分位数 / 错误率，Node 标准库） |
| `results/cache-{on,off}-{50,100,200}.jtl.gz` | JMeter 原始逐请求 CSV 结果（gzip 无损压缩，`gunzip` 后即 `.jtl`；原始单文件 150~185 MB） |
| `results/*.jtl.summary.json` | 每轮汇总（样本数、吞吐、均值、P50/P90/P95/P99、错误率、响应码分布） |
| `results/*.log` | JMeter 运行日志 |

## 已知偏差与方法备注

- 首次"缓存关"会话中，被测服务进程被本机后台任务管理终止（JMeter 记录为 Connection refused，
  应用日志无任何错误、内核无 OOM）；受控重跑（逐轮起服、轮间健康检查）三个梯度全程存活且 0 错误，
  本文数据取自受控重跑。压测期间应用行为与集成测试一致。
- 未预热缓存：冷启动 MISS 与 TTL 过期重建均包含在开缓存数据中，是对真实运行形态的保守估计。
- 单机同宿压测（应用、Postgres、Redis、JMeter 同机）：绝对值偏乐观，但开/关对比在同机同负载下成立，
  倍率结论不受影响。
- JMeter HEAD 请求不适用：404 语义经 GET 断言（X-Cache 头在 404 响应同样携带，见集成测试）。
