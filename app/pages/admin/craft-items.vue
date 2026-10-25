<script setup lang="ts">
/**
 * 技艺条目管理（工单 #5）：列表（含未发布，状态/子类别筛选 + 名称搜索）
 * + 新增/编辑（对话框表单，含标签关联与图集数组）+ 删除（确认框）。
 */
useHead({ title: '技艺条目管理 · 薪火' })

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AdminCraftListItem {
  id: string
  name: string
  subcategory: string
  region: string
  batch: string
  code: string
  status: 'DRAFT' | 'PUBLISHED'
  tags: string[]
  inheritorCount: number
}

interface ImageEntry { url: string, credit: string }

interface CraftItemForm {
  name: string
  subcategory: string
  batch: string
  code: string
  region: string
  history: string
  features: string
  images: ImageEntry[]
  videoUrl: string
  status: 'DRAFT' | 'PUBLISHED'
  tagIds: string[]
}

const STATUS_LABELS: Record<string, string> = { DRAFT: '草稿', PUBLISHED: '已发布' }

const list = ref<AdminCraftListItem[]>([])
const total = ref(0)
const loading = ref(false)
const statusFilter = ref('')
const subcategoryFilter = ref('')
const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)

// 子类别筛选项从数据里归纳（管理端含草稿，足够"能用"）
const subcategoryOptions = computed(() =>
  [...new Set(list.value.map(item => item.subcategory))],
)

// 标签选项（编辑对话框的标签多选）
const tagOptions = ref<Array<{ id: string, name: string }>>([])

const dialogVisible = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const form = ref<CraftItemForm>(emptyForm())

function emptyForm(): CraftItemForm {
  return {
    name: '',
    subcategory: '',
    batch: '',
    code: '',
    region: '',
    history: '',
    features: '',
    images: [],
    videoUrl: '',
    status: 'PUBLISHED',
    tagIds: [],
  }
}

async function loadList() {
  loading.value = true
  try {
    const query = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value),
    })
    if (statusFilter.value) query.set('status', statusFilter.value)
    if (subcategoryFilter.value) query.set('subcategory', subcategoryFilter.value)
    if (keyword.value.trim()) query.set('q', keyword.value.trim())
    const body = await $fetch<{ items: AdminCraftListItem[], total: number }>(`/api/admin/craft-items?${query}`)
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

async function openCreate() {
  editingId.value = null
  form.value = emptyForm()
  dialogVisible.value = true
  await ensureTagOptions()
}

async function openEdit(row: AdminCraftListItem) {
  editingId.value = row.id
  const detail = await $fetch<CraftItemForm & { images: ImageEntry[], videoUrl: string | null }>(`/api/admin/craft-items/${row.id}`)
  form.value = {
    name: detail.name,
    subcategory: detail.subcategory,
    batch: detail.batch,
    code: detail.code,
    region: detail.region,
    history: detail.history,
    features: detail.features,
    images: detail.images.map(img => ({ url: img.url, credit: img.credit })),
    videoUrl: detail.videoUrl ?? '',
    status: detail.status,
    tagIds: detail.tagIds,
  }
  dialogVisible.value = true
  await ensureTagOptions()
}

async function ensureTagOptions() {
  if (tagOptions.value.length > 0) return
  const body = await $fetch<{ items: Array<{ id: string, name: string }> }>('/api/admin/tags?pageSize=100')
  tagOptions.value = body.items
}

async function onSave() {
  saving.value = true
  try {
    const payload = { ...form.value, videoUrl: form.value.videoUrl.trim() || null }
    if (editingId.value) {
      await $fetch(`/api/admin/craft-items/${editingId.value}`, { method: 'PUT', body: payload })
    }
    else {
      await $fetch('/api/admin/craft-items', { method: 'POST', body: payload })
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await loadList()
  }
  catch (err) {
    ElMessage.error(apiErrorMessage(err))
  }
  finally {
    saving.value = false
  }
}

async function onDelete(row: AdminCraftListItem) {
  try {
    await ElMessageBox.confirm(
      `确定删除技艺条目「${row.name}」吗？其传承人与标签关联将一并解除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  }
  catch {
    return
  }
  try {
    await $fetch(`/api/admin/craft-items/${row.id}`, { method: 'DELETE' })
    ElMessage.success('已删除')
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
      <h1 class="mr-auto text-xl font-bold">技艺条目</h1>
      <el-select v-model="statusFilter" clearable placeholder="全部状态" class="w-32" @change="onFilterChange">
        <el-option label="已发布" value="PUBLISHED" />
        <el-option label="草稿" value="DRAFT" />
      </el-select>
      <el-select
        v-model="subcategoryFilter"
        clearable
        filterable
        allow-create
        placeholder="全部子类别"
        class="w-40"
        @change="onFilterChange"
      >
        <el-option v-for="sub in subcategoryOptions" :key="sub" :label="sub" :value="sub" />
      </el-select>
      <el-input v-model="keyword" placeholder="按名称搜索" clearable class="w-56" @change="onFilterChange" />
      <el-button type="primary" @click="openCreate">新增条目</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="name" label="名称" min-width="180" />
      <el-table-column prop="subcategory" label="子类别" width="100" />
      <el-table-column prop="batch" label="批次" width="150" />
      <el-table-column prop="code" label="编号" width="90" />
      <el-table-column prop="region" label="申报地区" min-width="130" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'PUBLISHED' ? 'success' : 'info'">{{ STATUS_LABELS[row.status] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="标签" min-width="150">
        <template #default="{ row }">
          <el-tag v-for="tag in row.tags" :key="tag" size="small" class="mr-1">{{ tag }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="inheritorCount" label="传承人" width="80" />
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑技艺条目' : '新增技艺条目'" width="640px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="子类别" required>
          <el-input v-model="form.subcategory" placeholder="如：陶瓷、织绣、漆器" />
        </el-form-item>
        <el-form-item label="批次" required>
          <el-input v-model="form.batch" placeholder="如：第一批（2006 年）" />
        </el-form-item>
        <el-form-item label="编号" required>
          <el-input v-model="form.code" placeholder="如：Ⅷ-7" />
        </el-form-item>
        <el-form-item label="申报地区" required>
          <el-input v-model="form.region" />
        </el-form-item>
        <el-form-item label="历史渊源" required>
          <el-input v-model="form.history" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="工艺特色" required>
          <el-input v-model="form.features" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="图集">
          <div class="w-full space-y-2">
            <div v-for="(img, index) in form.images" :key="index" class="flex gap-2">
              <el-input v-model="img.url" placeholder="图片地址" />
              <el-input v-model="img.credit" placeholder="出处与许可" class="w-56" />
              <el-button @click="form.images.splice(index, 1)">移除</el-button>
            </div>
            <el-button size="small" @click="form.images.push({ url: '', credit: '' })">添加图片</el-button>
          </div>
        </el-form-item>
        <el-form-item label="视频外链">
          <el-input v-model="form.videoUrl" placeholder="B 站视频链接，可留空" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="PUBLISHED">已发布</el-radio>
            <el-radio value="DRAFT">草稿</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="form.tagIds" multiple filterable placeholder="选择标签" class="w-full">
            <el-option v-for="tag in tagOptions" :key="tag.id" :label="tag.name" :value="tag.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
