import { useRedis } from '../redis'

/**
 * 独立缓存服务（工单 #9）：与业务层分离的通用 cache-aside 机制。
 * 业务层只提供缓存键、TTL 与回源函数，不感知 Redis 读写细节；
 * 本模块不理解技艺条目等业务概念，可被报告独立论述。
 *
 * 语义约定：
 * - HIT：本次请求的 Redis GET 命中（含空值标记）；
 * - MISS：未命中并触发回源；
 * - BYPASS：CACHE_ENABLED 关闭，直接回源、不读写 Redis。
 * 命中/未命中计数经 Redis INCR 累积（/api/health 只读暴露），计数失败只记日志。
 * 缓存层故障（Redis 不可用）时降级为直查，不允许拖垮业务读取。
 */

export type CacheOutcome = 'HIT' | 'MISS' | 'BYPASS'

export interface CacheAsideOptions<T> {
  /** 缓存键：由业务层命名，须含业务前缀与稳定标识（如 cache:craft-item:detail:<id>） */
  key: string
  /** 命中值 TTL（毫秒）；写入时附加随机抖动防同批键同时过期（雪崩） */
  ttlMs: number
  /** 空值 TTL（毫秒）：回源结果为 null（业务上不存在）时以更短 TTL 缓存空值标记，防穿透 */
  nullTtlMs: number
  /** 回源函数：未命中时调用；返回 null 表示“业务上不存在” */
  loader: () => Promise<T | null>
}

export interface CacheAsideResult<T> {
  value: T | null
  outcome: CacheOutcome
}

/** cache-aside 读取：命中直返；未命中经 singleflight 互斥回源（同一键同一时刻仅一次回源，其余等待共享结果），
 *  回源完成后写缓存；空值结果以短 TTL 缓存空值标记（防穿透） */
export async function cacheAside<T>(options: CacheAsideOptions<T>): Promise<CacheAsideResult<T>> {
  if (!isCacheEnabled()) {
    return { value: await options.loader(), outcome: 'BYPASS' }
  }
  const redis = useRedis()
  try {
    const raw = await redis.get(options.key)
    if (raw !== null) {
      await incrStat('hit')
      return { value: decodeValue<T>(raw), outcome: 'HIT' }
    }
  }
  catch {
    // Redis 读失败视为未命中，降级回源
  }
  // 未命中：进入互斥区。miss 计数在互斥区内执行——同一波并发只计一次（互斥重建可观测）
  const value = await loadWithSingleflight(options.key, async () => {
    try {
      // 双检：多进程部署下另一进程的回源可能已在本进程排队期间写入缓存
      const raw = await redis.get(options.key)
      if (raw !== null) {
        await incrStat('hit')
        return decodeValue<T>(raw)
      }
    }
    catch {
      // Redis 读失败照常回源
    }
    await incrStat('miss')
    const loaded = await options.loader()
    try {
      const ttlMs = loaded === null ? options.nullTtlMs : options.ttlMs
      await redis.set(options.key, encodeValue(loaded), 'PX', ttlMs + ttlJitter(ttlMs))
    }
    catch {
      // 缓存写失败不影响本次回源结果
    }
    return loaded
  })
  return { value, outcome: 'MISS' }
}

// singleflight：进程内去重表。挂在 globalThis 与 prisma/redis 单例同理，开发热载（HMR）不随模块重建丢表
const globalForSingleflight = globalThis as unknown as { __xinhuoCacheInflight?: Map<string, Promise<unknown>> }
const inflightLoads: Map<string, Promise<unknown>> = globalForSingleflight.__xinhuoCacheInflight ??= new Map()

/** 同一键的并发未命中只执行一次 load，其余请求共享同一 Promise；
 *  load 失败时所有等待者共同收到该错误，表项经 finally 清理（完成/失败均移除） */
function loadWithSingleflight<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = inflightLoads.get(key) as Promise<T> | undefined
  if (existing) return existing
  const promise: Promise<T> = load().finally(() => {
    if (inflightLoads.get(key) === promise) inflightLoads.delete(key)
  })
  inflightLoads.set(key, promise)
  return promise
}

/** 缓存开关：默认开启；设为 false/0 关闭（压测对比用）。每次调用时读取，便于按进程切换 */
export function isCacheEnabled(): boolean {
  const raw = process.env.CACHE_ENABLED
  return raw !== 'false' && raw !== '0'
}

export interface CacheStats {
  enabled: boolean
  /** 缓存命中次数（累积值，Redis 重启归零） */
  hit: number
  /** 缓存未命中（回源）次数（累积值） */
  miss: number
}

/** 缓存统计（/api/health 只读暴露）：Redis 不可用时返回 0 值，健康状态本身已另行报告 Redis 连通性 */
export async function getCacheStats(): Promise<CacheStats> {
  const enabled = isCacheEnabled()
  try {
    const [hit, miss] = await useRedis().mget(CACHE_STATS_KEYS.hit, CACHE_STATS_KEYS.miss)
    return { enabled, hit: Number(hit ?? 0), miss: Number(miss ?? 0) }
  }
  catch {
    return { enabled, hit: 0, miss: 0 }
  }
}

const CACHE_STATS_KEYS = {
  hit: 'cache:stats:hit',
  miss: 'cache:stats:miss',
} as const

async function incrStat(name: keyof typeof CACHE_STATS_KEYS): Promise<void> {
  try {
    await useRedis().incr(CACHE_STATS_KEYS[name])
  }
  catch {
    // 计数失败不影响主流程
  }
}

/** TTL 随机抖动（0 ~ 15%），避免大量同批键同时失效集中回源 */
function ttlJitter(ttlMs: number): number {
  return Math.floor(Math.random() * ttlMs * 0.15)
}

/** 空值标记：与真实值共用一个键、以信封区分；TTL 在写入时决定（空值用 nullTtlMs） */
const NULL_SENTINEL = '{"n":1}'

function encodeValue(value: unknown): string {
  return value === null ? NULL_SENTINEL : JSON.stringify({ v: value })
}

function decodeValue<T>(raw: string): T | null {
  if (raw === NULL_SENTINEL) return null
  return (JSON.parse(raw) as { v: T }).v
}
