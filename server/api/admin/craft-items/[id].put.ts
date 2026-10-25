import { updateAdminCraftItem } from '../../../utils/services/admin-craft-item.service'

/** 更新技艺条目（管理端，工单 #5）：整体替换语义，含标签关联替换 */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  return updateAdminCraftItem(getRouterParam(event, 'id') ?? '', await readBody(event))
})
