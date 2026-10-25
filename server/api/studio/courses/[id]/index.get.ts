import { getStudioCourse } from '../../../../utils/services/course.service'

/** 课程详情（创作端，工单 #6）：作者可见全部状态，含步骤列表 */
export default defineStudioHandler(async (event) => {
  const user = await requireStudioUser(event)
  return getStudioCourse(user.id, user.role, getRouterParam(event, 'id') ?? '')
})
