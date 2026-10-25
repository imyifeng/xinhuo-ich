import { updateStudioCourse } from '../../../../utils/services/course.service'

/** 更新课程信息（创作端，工单 #6）：部分更新语义，仅草稿/已驳回可改 */
export default defineStudioHandler(async (event) => {
  const user = await requireStudioUser(event)
  return updateStudioCourse(user.id, user.role, getRouterParam(event, 'id') ?? '', await readBody(event))
})
