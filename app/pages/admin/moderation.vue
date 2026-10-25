<script setup lang="ts">
/**
 * 内容审核（工单 #7 / 用户故事 24）：帖子与评论的下架（HIDDEN）/恢复（VISIBLE）。
 * 列表含已下架内容，可按状态筛选；与账号管理页保持一致的 Element Plus 风格。
 */
useHead({ title: '内容审核 · 薪火' })

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface PostRow {
  id: string
  title: string
  author: { id: number, displayName: string }
  status: 'VISIBLE' | 'HIDDEN'
  commentCount: number
  createdAt: string
}

interface CommentRow {
  id: string
  content: string
  author: { id: number, displayName: string }
  post: { id: string, title: string }
  status: 'VISIBLE' | 'HIDDEN'
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = { VISIBLE: '可见', HIDDEN: '已下架' }

const activeTab = ref<'posts' | 'comments'>('posts')

// ---- 帖子 ----
const posts = ref<PostRow[]>([])
const postTotal = ref(0)
const postLoading = ref(false)
const postStatusFilter = ref('')
const postPage = ref(1)
const postPageSize = ref(20)

async function loadPosts() {
  postLoading.value = true
  try {
    const query = new URLSearchParams({ page: String(postPage.value), pageSize: String(postPageSize.value) })
    if (postStatusFilter.value) query.set('status', postStatusFilter.value)
    const body = await $fetch<{ items: PostRow[], total: number }>(`/api/admin/posts?${query}`)
    posts.value = body.items
    postTotal.value = body.total
  }
  finally {
    postLoading.value = false
  }
}

function onPostFilterChange() {
  postPage.value = 1
  void loadPosts()
}

async function onPostStatusChange(row: PostRow, status: string) {
  const action = status === 'HIDDEN' ? '下架' : '恢复'
  try {
    await $fetch(`/api/admin/posts/${row.id}/status`, { method: 'PUT', body: { status } })
    ElMessage.success(`已${action}帖子「${row.title}」`)
  }
  catch (err) {
    ElMessage.error(apiErrorMessage(err))
  }
  await loadPosts()
}

// ---- 评论 ----
const comments = ref<CommentRow[]>([])
const commentTotal = ref(0)
const commentLoading = ref(false)
const commentStatusFilter = ref('')
const commentPage = ref(1)
const commentPageSize = ref(20)

async function loadComments() {
  commentLoading.value = true
  try {
    const query = new URLSearchParams({ page: String(commentPage.value), pageSize: String(commentPageSize.value) })
    if (commentStatusFilter.value) query.set('status', commentStatusFilter.value)
    const body = await $fetch<{ items: CommentRow[], total: number }>(`/api/admin/comments?${query}`)
    comments.value = body.items
    commentTotal.value = body.total
  }
  finally {
    commentLoading.value = false
  }
}

function onCommentFilterChange() {
  commentPage.value = 1
  void loadComments()
}

async function onCommentStatusChange(row: CommentRow, status: string) {
  const action = status === 'HIDDEN' ? '下架' : '恢复'
  try {
    await $fetch(`/api/admin/comments/${row.id}/status`, { method: 'PUT', body: { status } })
    ElMessage.success(`已${action}该评论`)
  }
  catch (err) {
    ElMessage.error(apiErrorMessage(err))
  }
  await loadComments()
}

function excerpt(content: string) {
  return content.length > 40 ? `${content.slice(0, 40)}…` : content
}

onMounted(() => {
  void loadPosts()
  void loadComments()
})
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">内容审核</h1>
    <p class="text-sm text-stone-500">下架违规帖子与评论；下架后前台立即不可见，可随时恢复。</p>

    <el-tabs v-model="activeTab">
      <!-- 帖子审核 -->
      <el-tab-pane label="帖子" name="posts">
        <div class="mb-3 flex items-center gap-3">
          <el-select v-model="postStatusFilter" clearable placeholder="全部状态" class="w-36" @change="onPostFilterChange">
            <el-option label="可见" value="VISIBLE" />
            <el-option label="已下架" value="HIDDEN" />
          </el-select>
        </div>

        <el-table v-loading="postLoading" :data="posts" border stripe>
          <el-table-column prop="title" label="标题" min-width="240" show-overflow-tooltip />
          <el-table-column label="作者" width="140">
            <template #default="{ row }">{{ row.author.displayName }}</template>
          </el-table-column>
          <el-table-column label="评论数" width="90" prop="commentCount" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'VISIBLE' ? 'success' : 'danger'">
                {{ STATUS_LABELS[row.status] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="发布时间" width="180">
            <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
          </el-table-column>
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'VISIBLE'"
                type="danger"
                size="small"
                plain
                @click="onPostStatusChange(row, 'HIDDEN')"
              >
                下架
              </el-button>
              <el-button v-else type="success" size="small" plain @click="onPostStatusChange(row, 'VISIBLE')">
                恢复
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="postPage"
          v-model:page-size="postPageSize"
          :total="postTotal"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20, 50]"
          class="mt-4"
          @current-change="loadPosts"
          @size-change="onPostFilterChange"
        />
      </el-tab-pane>

      <!-- 评论审核 -->
      <el-tab-pane label="评论" name="comments">
        <div class="mb-3 flex items-center gap-3">
          <el-select v-model="commentStatusFilter" clearable placeholder="全部状态" class="w-36" @change="onCommentFilterChange">
            <el-option label="可见" value="VISIBLE" />
            <el-option label="已下架" value="HIDDEN" />
          </el-select>
        </div>

        <el-table v-loading="commentLoading" :data="comments" border stripe>
          <el-table-column label="内容" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">{{ excerpt(row.content) }}</template>
          </el-table-column>
          <el-table-column label="作者" width="140">
            <template #default="{ row }">{{ row.author.displayName }}</template>
          </el-table-column>
          <el-table-column label="所属帖子" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.post.title }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'VISIBLE' ? 'success' : 'danger'">
                {{ STATUS_LABELS[row.status] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="发布时间" width="180">
            <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
          </el-table-column>
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'VISIBLE'"
                type="danger"
                size="small"
                plain
                @click="onCommentStatusChange(row, 'HIDDEN')"
              >
                下架
              </el-button>
              <el-button v-else type="success" size="small" plain @click="onCommentStatusChange(row, 'VISIBLE')">
                恢复
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="commentPage"
          v-model:page-size="commentPageSize"
          :total="commentTotal"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20, 50]"
          class="mt-4"
          @current-change="loadComments"
          @size-change="onCommentFilterChange"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
