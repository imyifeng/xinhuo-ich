import { deleteAdminCraftItem } from '../../../utils/services/admin-craft-item.service'

/** 删除技艺条目（管理端，工单 #5）：传承人与条目标签随外键级联解除 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  await deleteAdminCraftItem(getRouterParam(event, 'id') ?? '')
  return { ok: true }
})
