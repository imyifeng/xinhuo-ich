import { submitStudioCourse } from '../../../../utils/services/course.service'

/** 提交审核（创作端，工单 #6）：DRAFT/REJECTED → PENDING_REVIEW，需至少一个步骤 */
export default defineStudioHandler(async (event) => {
  const user = await requireStudioUser(event)
  return submitStudioCourse(user.id, user.role, getRouterParam(event, 'id') ?? '')
})
