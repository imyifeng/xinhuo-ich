import { publishAdminCourse } from '../../../../utils/services/admin-course.service'

/** 发布课程（管理端，工单 #6）：仅待审核课程可发布（PENDING_REVIEW → PUBLISHED） */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  return publishAdminCourse(getRouterParam(event, 'id') ?? '')
})
