import { createStudioCourse } from '../../../utils/services/course.service'

/** 创建课程（传承人端，工单 #6）：默认草稿，挂载到指定技艺条目 */
export default defineStudioHandler(async (event) => {
  const user = await requireStudioUser(event)
  setResponseStatus(event, 201)
  return createStudioCourse(user.id, await readBody(event))
})
