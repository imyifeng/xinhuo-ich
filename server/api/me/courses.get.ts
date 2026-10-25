import { listMyCourseProgress } from '../../utils/services/course.service'

/** 我的课程进度（学习者端，工单 #6）：每门已开始课程返回 已完成步骤数 / 总步骤数 */
export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  return listMyCourseProgress(user.id)
})
