import { getHealthStatus } from '../utils/services/health.service'

/** 健康检查：数据库不可用返回 503（Redis 不可用仅标记 degraded，仍返回 200） */
export default defineEventHandler(async (event) => {
  const health = await getHealthStatus()
  if (health.status === 'error') {
    setResponseStatus(event, 503)
  }
  return health
})
