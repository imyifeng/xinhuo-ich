# JMeter 压测结果整理（性能测试素材）

对应报告第 6 章「系统测试」性能测试小节。**原始数据、脚本与方法论在 [`docs/perf/`](../../perf/)**
（工单 #8/#9 产物，含 JMeter 测试计划、逐请求原始 JTL、确定性汇总脚本），本目录不重复归档原始数据，
只做报告可直接引用的整理：引用表 + 结论段 + 对比图。

## 报告可直接引用的结果表

被测接口：热点路径 `GET /api/craft-items/:id`（响应体约 2.2 KB）；负载模型：闭环压测，
ramp-up 5s + 持续 60s；断言：响应码 200；六轮全部 **0 错误**。数据源：`docs/perf/results/*.summary.json`。

| 场景 | 并发 | 样本数 | 吞吐（req/s） | P50 (ms) | P95 (ms) | P99 (ms) | 错误率 | 吞吐倍率（开/关） |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 缓存开 | 50 | 1,068,747 | **17,829.4** | 3 | **4** | 6 | 0% | **7.5×** |
| 缓存开 | 100 | 868,982 | **14,498.0** | 6 | **10** | 12 | 0% | **6.8×** |
| 缓存开 | 200 | 960,997 | **16,029.2** | 12 | **17** | 20 | 0% | **7.0×** |
| 缓存关 | 50 | 142,652 | 2,379.9 | 20 | 27 | 33 | 0% | — |
| 缓存关 | 100 | 127,441 | 2,126.3 | 45 | 56 | 67 | 0% | — |
| 缓存关 | 200 | 138,140 | 2,304.6 | 80 | 113 | 155 | 0% | — |

## 对比图

| 文件 | 说明 |
| --- | --- |
| `comparison.svg` | 吞吐与 P95 双面板分组柱状图（`chart.mjs` 从 `docs/perf/results/*.summary.json` 生成，矢量，浏览器直接打开） |
| `comparison.png` | 上图的位图版（报告插入用便利产物；以 SVG 为准） |
| `chart.mjs` | 图生成脚本（Node 标准库零依赖；重生成：`node docs/report-assets/perf/chart.mjs`） |

## 结论段（报告可直接改写引用）

> 在同一生产构建、同一宿主机（应用与 PostgreSQL 18、Redis 8 同机）环境下，对热点路径
> 「技艺条目详情」接口做开/关缓存的对照压测：关闭缓存时逐请求回源数据库，吞吐被 Prisma/pg
> 连接池钉死在约 2.1~2.4k req/s，P95 延迟随并发近线性恶化（27 → 56 → 113 ms），继续加压只
> 转化为排队延迟；开启 Redis cache-aside 缓存后，命中请求不触达数据库，吞吐提升至约
> 1.45~1.78 万 req/s（**6.8 ~ 7.5 倍**），P95 稳定在 4 ~ 17 ms。全程 0 错误。开缓存场景未做
> 预热，冷启动 MISS 与 60s TTL 过期重建均包含在数据中（singleflight 互斥重建在压测窗口内真实
> 生效），属对真实运行形态的保守估计。该结果验证了 ADR 0001 复杂工程问题 2 的结论：热点内容
> 必须有缓存防护，且失效路径需与后台写路径联动（管理端写操作已接线 `invalidateCraftItem`）。

三条曲线特征（展开论述可用）：

1. **缓存关**：吞吐不随并发增长（连接池饱和），延迟随并发近线性上升——排队发生在 Prisma 连接池；
2. **缓存开**：吞吐提升一个数量级，延迟随并发缓慢上升（Redis 单键读 + JSON 序列化在事件循环内排队）；
3. 倍率随并发稳定在 6.8 ~ 7.5×，说明瓶颈与收益均来自缓存命中路径本身，与负载强度弱相关。

## 复现命令

```bash
# 1. 生产构建
pnpm build

# 2. 起被测服务（开缓存 / 关缓存各起一次）
PORT=3737 CACHE_ENABLED=true \
DATABASE_URL=postgresql://xinhuo:xinhuo@localhost:5433/xinhuo_dev_t8 \
REDIS_URL=redis://localhost:6380/4 node .output/server/index.mjs

# 3. 逐梯度压测（重复换 -Jthreads=50/100/200）
cd docs/perf
docker run --rm --network host -v "$PWD":/perf -w /perf justb4/jmeter:latest \
  -n -t /perf/craft-item-detail.jmx -l /perf/results/cache-on-50.jtl -j /perf/results/cache-on-50.log \
  -Jthreads=50 -Jrampup=5 -Jduration=60 \
  -JitemId=cmvnceqeq0000bj59x6vrt0la -Jport=3737

# 4. 汇总（输出同名 .summary.json）+ 重绘本目录对比图
node summarize.mjs results/cache-on-50.jtl [...]
node ../report-assets/perf/chart.mjs
```

完整方法、测试环境与已知偏差（含首轮压测被本机后台任务终止后受控重跑的说明）见
[`docs/perf/README.md`](../../perf/README.md)。
