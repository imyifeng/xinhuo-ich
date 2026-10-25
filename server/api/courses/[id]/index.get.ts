import { getPublishedCourseDetail } from '../../../utils/services/course.service'

/** 已发布课程详情（前台，工单 #6）：不存在或未发布一律 404。
 *  游客仅预览大纲（步骤标题，用户故事 4）；登录用户额外获得步骤全文、完成标记与学习进度。 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const session = await getSessionUser(event)
  const detail = await getPublishedCourseDetail(id, session?.userId ?? null)
  if (!detail) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: '课程不存在或未发布' })
  }
  return detail
})
