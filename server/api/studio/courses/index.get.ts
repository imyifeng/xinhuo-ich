import { listStudioCourses } from '../../../utils/services/course.service'

/** 我的课程列表（传承人端，工单 #6）：仅本人课程，含状态与步骤数 */
export default defineStudioHandler(async (event) => {
  const user = await requireStudioUser(event)
  return listStudioCourses(user.id)
})
