import { listAdminInheritors } from '../../../utils/services/admin-inheritor.service'

/** 传承人列表（管理端，工单 #5）：可按所属条目筛选 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  return listAdminInheritors({
    craftItemId: typeof query.craftItemId === 'string' ? query.craftItemId : undefined,
  })
})
