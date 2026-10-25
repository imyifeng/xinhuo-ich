import { getAdminCourse } from '../../../../utils/services/admin-course.service'

/** 课程详情（管理端，工单 #6）：任意状态可见，含步骤内容（审核页用） */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  return getAdminCourse(getRouterParam(event, 'id') ?? '')
})
