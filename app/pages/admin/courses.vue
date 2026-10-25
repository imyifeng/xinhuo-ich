<script setup lang="ts">
/**
 * 课程审核（管理端，工单 #6 / 用户故事 23）：待审列表 + 查看步骤内容 + 发布/驳回。
 * 与其他 /admin 页面同风格（Element Plus 快速搭 CRUD，仅求能用）。
 */
useHead({ title: '课程审核 · 薪火' })

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface CourseRow {
  id: string
  title: string
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED'
  craftItemName: string
  author: { id: number, username: string, displayName: string }
  stepCount: number
  rejectReason: string | null
  updatedAt: string
}

interface AdminCourseDetail extends CourseRow {
  intro: string
  steps: Array<{ id: string, order: number, title: string, content: string, imageUrl: string | null }>
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING_REVIEW: '待审核',
  PUBLISHED: '已发布',
  REJECTED: '已驳回',
}

const list = ref<CourseRow[]>([])
const total = ref(0)
const loading = ref(false)
const statusFilter = ref('PENDING_REVIEW')
const page = ref(1)
const pageSize = ref(20)

async function loadList() {
  loading.value = true
  try {
    const query = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize.value) })
    if (statusFilter.value) query.set('status', statusFilter.value)
    const body = await $fetch<{ items: CourseRow[], total: number }>(`/api/admin/courses?${query}`)
    list.value = body.items
    total.value = body.total
  }
  finally {
    loading.value = false
  }
}

function onFilterChange() {
  page.value = 1
  void loadList()
}

// 查看步骤内容（审核前通读课程）
const detailVisible = ref(false)
const detail = ref<AdminCourseDetail | null>(null)
const detailLoading = ref(false)

async function onView(row: CourseRow) {
  detailVisible.value = true
  detailLoading.value = true
  try {
    detail.value = await $fetch<AdminCourseDetail>(`/api/admin/courses/${row.id}`)
  }
  finally {
    detailLoading.value = false
  }
}

async function onPublish(row: CourseRow) {
  try {
    await ElMessageBox.confirm(`确定发布课程「${row.title}」吗？发布后对所有学习者可见。`, '发布确认', {
      confirmButtonText: '发布',
      cancelButtonText: '取消',
      type: 'warning',
    })
  }
  catch {
    return
  }
  try {
    await $fetch(`/api/admin/courses/${row.id}/publish`, { method: 'POST' })
    ElMessage.success('已发布')
    await loadList()
  }
  catch (err) {
    ElMessage.error(apiErrorMessage(err))
  }
}

async function onReject(row: CourseRow) {
  let reason: string
  try {
    const result = await ElMessageBox.prompt('请输入驳回理由（作者将看到该理由，可留空）', `驳回「${row.title}」`, {
      confirmButtonText: '驳回',
      cancelButtonText: '取消',
      inputPlaceholder: '如：步骤内容过于简略，请补充配图',
      inputValidator: (value: string) => value.length <= 500 || '驳回理由不超过 500 个字符',
    })
    reason = result.value ?? ''
  }
  catch {
    return
  }
  try {
    await $fetch(`/api/admin/courses/${row.id}/reject`, { method: 'POST', body: { reason: reason.trim() || undefined } })
    ElMessage.success('已驳回')
    await loadList()
  }
  catch (err) {
    ElMessage.error(apiErrorMessage(err))
  }
}

onMounted(loadList)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="mr-auto text-xl font-bold">课程审核</h1>
      <el-select v-model="statusFilter" clearable placeholder="全部状态" class="w-40" @change="onFilterChange">
        <el-option label="待审核" value="PENDING_REVIEW" />
        <el-option label="草稿" value="DRAFT" />
        <el-option label="已发布" value="PUBLISHED" />
        <el-option label="已驳回" value="REJECTED" />
      </el-select>
    </div>

    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="title" label="课程标题" min-width="200" />
      <el-table-column prop="craftItemName" label="所属条目" min-width="160" />
      <el-table-column label="作者" min-width="120">
        <template #default="{ row }">
          {{ row.author.displayName }}（{{ row.author.username }}）
        </template>
      </el-table-column>
      <el-table-column prop="stepCount" label="步骤数" width="90" align="center" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'PENDING_REVIEW' ? 'warning' : row.status === 'PUBLISHED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'info'">
            {{ STATUS_LABELS[row.status] ?? row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">
          {{ new Date(row.updatedAt).toLocaleString('zh-CN') }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="onView(row)">查看</el-button>
          <el-button v-if="row.status === 'PENDING_REVIEW'" size="small" type="success" @click="onPublish(row)">发布</el-button>
          <el-button v-if="row.status === 'PENDING_REVIEW'" size="small" type="danger" @click="onReject(row)">驳回</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      layout="total, sizes, prev, pager, next"
      :page-sizes="[10, 20, 50]"
      @current-change="loadList"
      @size-change="onFilterChange"
    />

    <!-- 步骤内容预览 -->
    <el-dialog v-model="detailVisible" :title="detail?.title ?? '课程详情'" width="680px">
      <div v-loading="detailLoading" class="max-h-[60vh] space-y-4 overflow-y-auto">
        <template v-if="detail">
          <p class="text-sm text-stone-500">
            {{ detail.craftItemName }} · 作者 {{ detail.author.displayName }} · {{ detail.stepCount }} 个步骤
          </p>
          <p class="text-sm leading-relaxed">{{ detail.intro }}</p>
          <div v-for="step in detail.steps" :key="step.id" class="rounded-lg border border-stone-200 p-4">
            <h4 class="font-medium">{{ step.order }}. {{ step.title }}</h4>
            <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-600">{{ step.content }}</p>
          </div>
        </template>
      </div>
    </el-dialog>
  </div>
</template>
