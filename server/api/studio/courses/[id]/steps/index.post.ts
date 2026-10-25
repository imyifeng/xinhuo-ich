import { addCourseStep } from '../../../../../utils/services/course.service'

/** 添加步骤（创作端，工单 #6）：追加到当前末尾 */
export default defineStudioHandler(async (event) => {
  const user = await requireStudioUser(event)
  setResponseStatus(event, 201)
  return addCourseStep(user.id, user.role, getRouterParam(event, 'id') ?? '', await readBody(event))
})
