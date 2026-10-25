import cron from 'node-cron'
import { rebuildProfilesAndRecommendations } from '../utils/services/recommendation.service'

/**
 * 画像与推荐每日离线重建（工单 #8 / 规格用户故事 28）：Nitro server plugin，随应用启动注册。
 *
 * - 每日 03:00（Asia/Shanghai）执行：深夜低峰，离线计算不挤占白天的请求线程；
 *   与管理员手动触发共用同一入口（内部 singleflight 防重入），撞车也只算一次。
 * - 测试环境不注册（vitest 起真实 Nitro 服务，定时任务会污染测试数据库断言）；
 *   生产可用 XINHUO_RECOMMENDATION_CRON=off 关闭（多实例部署时只留一个实例跑）。
 * - 失败只记日志不抛出：定时任务崩溃不能拖垮应用进程，次日重建会自愈。
 */
export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV === 'test') return
  if (process.env.XINHUO_RECOMMENDATION_CRON === 'off') return

  cron.schedule('0 3 * * *', () => {
    console.info('[recommendation] 每日画像与推荐重建开始')
    rebuildProfilesAndRecommendations()
      .then((result) => {
        console.info(
          `[recommendation] 重建完成：学习者 ${result.learnerCount}，画像 ${result.profileCount}，`
          + `k=${result.chosenK ?? '（跳过聚类）'}，推荐 ${result.recommendationCount} 条`,
        )
      })
      .catch((error) => {
        console.error('[recommendation] 每日重建失败', error instanceof Error ? error.message : error)
      })
  }, { timezone: 'Asia/Shanghai' })
})
