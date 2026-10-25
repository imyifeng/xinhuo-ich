import { startCourse } from '../../../utils/services/learning.service'
/** 开始课程（学习者端，工单 #6）：记 START_COURSE 事件，每课程每用户仅一次（幂等） */
export default defineCourseHandler(async (event) => {
  const user = await requireSessionUser(event)
  return startCourse(user.id, getRouterParam(event, 'id') ?? '')
})
