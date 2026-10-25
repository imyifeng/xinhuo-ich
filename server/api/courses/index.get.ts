import { listPublishedCourses } from '../../utils/services/course.service'

/** 已发布课程列表（前台，工单 #6）：游客可浏览，支持按技艺条目筛选（条目页「相关课程」共用） */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  return listPublishedCourses({
    craftItemId: typeof query.craftItemId === 'string' ? query.craftItemId : undefined,
  })
})
