import { deleteStudioCourse } from '../../../../utils/services/course.service'

/** 删除课程（创作端，工单 #6）：仅草稿/已驳回；步骤与学习记录级联删除 */
export default defineStudioHandler(async (event) => {
  const user = await requireStudioUser(event)
  await deleteStudioCourse(user.id, user.role, getRouterParam(event, 'id') ?? '')
  return { ok: true }
})
