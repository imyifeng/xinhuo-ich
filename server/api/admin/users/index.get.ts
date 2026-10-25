import { listAdminUsers } from '../../../utils/services/admin-user.service'

/** 账号列表（管理端，工单 #5）：requireAdmin 守卫，未登录与非管理员一律 403 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  return listAdminUsers()
})
