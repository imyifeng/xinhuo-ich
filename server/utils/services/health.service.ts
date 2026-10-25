import { usePrisma } from '../prisma'
import { useRedis } from '../redis'

export interface HealthStatus {
  /** ok：数据库可用（必要依赖）；degraded：Redis 不可用但数据库可用；error：数据库不可用 */
  status: 'ok' | 'degraded' | 'error'
  checks: { database: 'up' | 'down', redis: 'up' | 'down' }
  uptime: number
  timestamp: string
}

const REDIS_PING_TIMEOUT_MS = 2_000

/** 平台健康状态：数据库 + Redis 连通性（供 /api/health 与容器 healthcheck 使用） */
export async function getHealthStatus(): Promise<HealthStatus> {
  const [databaseUp, redisUp] = await Promise.all([checkDatabase(), checkRedis()])
  return {
    status: databaseUp ? (redisUp ? 'ok' : 'degraded') : 'error',
    checks: {
      database: databaseUp ? 'up' : 'down',
      redis: redisUp ? 'up' : 'down',
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }
}

async function checkDatabase(): Promise<boolean> {
  try {
    await usePrisma().$queryRaw`SELECT 1`
    return true
  }
  catch {
    return false
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const redis = useRedis()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        redis.ping(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`redis ping 超时（${REDIS_PING_TIMEOUT_MS}ms）`)),
            REDIS_PING_TIMEOUT_MS,
          )
        }),
      ])
      return true
    }
    finally {
      clearTimeout(timer)
    }
  }
  catch {
    return false
  }
}
