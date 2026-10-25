import { getCraftItemDetail } from '../../utils/services/craft-item.service'

/** 技艺条目详情（仅已发布）：不存在或未发布一律 404 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const detail = id ? await getCraftItemDetail(id) : null
  if (!detail) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: '技艺条目不存在或未发布' })
  }
  return detail
})
