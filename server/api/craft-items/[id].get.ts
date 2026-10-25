import { getCraftItemDetail } from '../../utils/services/craft-item.service'

/** 技艺条目详情（仅已发布）：不存在或未发布一律 404；
 *  登录用户（会话契约）浏览时记录 VIEW_ITEM 事件，游客不记 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const session = await getSessionUser(event)
  const detail = id ? await getCraftItemDetail(id, session?.userId ?? null) : null
  if (!detail) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: '技艺条目不存在或未发布' })
  }
  return detail
})
