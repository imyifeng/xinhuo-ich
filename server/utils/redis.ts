import Redis from 'ioredis'

/**
 * Redis 服务模块：ioredis 客户端单例（后续会话、热点缓存、singleflight 等复用此模块）。
 * 连接串来自 REDIS_URL；lazyConnect 使客户端创建时不立即建连，
 * 依赖方在首次命令时才触发连接，因此 Redis 未就绪不影响应用启动。
 */
function createRedisClient(): Redis {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL 未设置：请复制 .env.example 为 .env 并按需修改')
  }
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    retryStrategy: times => Math.min(times * 200, 5_000),
    // Prisma/业务层只存字符串，ioredis 默认 Buffer 返回对 JSON 会话存储不便
    stringNumbers: true,
  })
  // ioredis 的 error 事件若无监听会以未捕获异常冒出，这里仅记录（连接恢复由 retryStrategy 负责）
  client.on('error', (err) => {
    console.error('[redis]', err.message)
  })
  return client
}

const globalForRedis = globalThis as unknown as { __xinhuoRedis?: Redis }

/** 获取全局唯一的 Redis 客户端实例（Nitro 自动导入，server 内可直接调用） */
export function useRedis(): Redis {
  globalForRedis.__xinhuoRedis ??= createRedisClient()
  return globalForRedis.__xinhuoRedis
}
