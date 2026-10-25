<script setup lang="ts">
/**
 * 标签管理（工单 #5）：列表（名称搜索，含关联条目数）+ 新增/重命名（对话框）+ 删除（确认框，解除关联）。
 */
useHead({ title: '标签管理 · 薪火' })

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface TagRow {
  id: string
  name: string
  itemCount: number
}

const list = ref<TagRow[]>([])
const loading = ref(false)
const keyword = ref('')

const dialogVisible = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const tagName = ref('')

async function loadList() {
  loading.value = true
  try {
    const query = keyword.value.trim() ? `?q=${encodeURIComponent(keyword.value.trim())}` : ''
    const body = await $fetch<{ items: TagRow[] }>(`/api/admin/tags${query}`)
    list.value = body.items
  }
  finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  tagName.value = ''
  dialogVisible.value = true
}

function openEdit(row: TagRow) {
  editingId.value = row.id
  tagName.value = row.name
  dialogVisible.value = true
}

async function onSave() {
  saving.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/admin/tags/${editingId.value}`, { method: 'PUT', body: { name: tagName.value } })
    }
    else {
      await $fetch('/api/admin/tags', { method: 'POST', body: { name: tagName.value } })
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

async function onDelete(row: TagRow) {
  const hint = row.itemCount > 0 ? `该标签已关联 ${row.itemCount} 个条目，删除将解除关联。` : ''
  try {
    await ElMessageBox.confirm(`确定删除标签「${row.name}」吗？${hint}`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  }
  catch {
    return
  }
  try {
    await $fetch(`/api/admin/tags/${row.id}`, { method: 'DELETE' })
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
      <h1 class="mr-auto text-xl font-bold">标签</h1>
      <el-input v-model="keyword" placeholder="按名称搜索" clearable class="w-56" @change="loadList" />
      <el-button type="primary" @click="openCreate">新增标签</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="name" label="标签名" min-width="200" />
      <el-table-column prop="itemCount" label="关联条目数" width="120" />
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">重命名</el-button>
          <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '重命名标签' : '新增标签'" width="420px">
      <el-form label-width="80px" @submit.prevent="onSave">
        <el-form-item label="标签名" required>
          <el-input v-model="tagName" @keyup.enter="onSave" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
