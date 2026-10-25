import { listAdminComments } from '../../../utils/services/admin-post.service'

/** 评论列表（管理端，工单 #7）：含已下架，?status=&postId=&page=&pageSize= */
export default defineAdminHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  return listAdminComments({
    status: typeof query.status === 'string' ? query.status : undefined,
    postId: typeof query.postId === 'string' ? query.postId : undefined,
    page: typeof query.page === 'string' || typeof query.page === 'number' ? Number(query.page) : undefined,
    pageSize: typeof query.pageSize === 'string' || typeof query.pageSize === 'number' ? Number(query.pageSize) : undefined,
  })
})
