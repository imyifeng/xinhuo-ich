<script setup lang="ts">
/**
 * 传承人管理（工单 #5）：列表（按条目筛选）+ 新增/编辑（对话框表单，挂条目）+ 删除（确认框）。
 */
useHead({ title: '传承人管理 · 薪火' })

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface InheritorRow {
  id: string
  name: string
  level: string
  bio: string
  craftItemId: string
  craftItemName: string
}

interface CraftItemOption { id: string, name: string }

const list = ref<InheritorRow[]>([])
const loading = ref(false)
const craftItemFilter = ref('')
const itemOptions = ref<CraftItemOption[]>([])

const dialogVisible = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const form = ref({ name: '', level: '', bio: '', craftItemId: '' })

async function loadList() {
  loading.value = true
  try {
    const query = craftItemFilter.value ? `?craftItemId=${craftItemFilter.value}` : ''
    const body = await $fetch<{ items: InheritorRow[] }>(`/api/admin/inheritors${query}`)
    list.value = body.items
  }
  finally {
    loading.value = false
  }
}

async function ensureItemOptions() {
  if (itemOptions.value.length > 0) return
  const body = await $fetch<{ items: CraftItemOption[] }>('/api/admin/craft-items?pageSize=100')
  itemOptions.value = body.items.map(item => ({ id: item.id, name: item.name }))
}

function openCreate() {
  editingId.value = null
  form.value = { name: '', level: '', bio: '', craftItemId: '' }
  dialogVisible.value = true
  void ensureItemOptions()
}

function openEdit(row: InheritorRow) {
  editingId.value = row.id
  form.value = { name: row.name, level: row.level, bio: row.bio, craftItemId: row.craftItemId }
  dialogVisible.value = true
  void ensureItemOptions()
}

async function onSave() {
  saving.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/admin/inheritors/${editingId.value}`, { method: 'PUT', body: form.value })
    }
    else {
      await $fetch('/api/admin/inheritors', { method: 'POST', body: form.value })
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

async function onDelete(row: InheritorRow) {
  try {
    await ElMessageBox.confirm(`确定删除传承人「${row.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  }
  catch {
    return
  }
  try {
    await $fetch(`/api/admin/inheritors/${row.id}`, { method: 'DELETE' })
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
      <h1 class="mr-auto text-xl font-bold">传承人</h1>
      <el-select
        v-model="craftItemFilter"
        clearable
        filterable
        placeholder="按所属条目筛选"
        class="w-72"
        @change="loadList"
      >
        <el-option v-for="item in itemOptions" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-button type="primary" @click="openCreate">新增传承人</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="name" label="姓名" width="160" />
      <el-table-column prop="level" label="级别" width="120" />
      <el-table-column prop="bio" label="简介" min-width="260" show-overflow-tooltip />
      <el-table-column prop="craftItemName" label="所属技艺条目" min-width="180" />
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑传承人' : '新增传承人'" width="520px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="姓名" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="级别" required>
          <el-input v-model="form.level" placeholder="如：国家级 / 省级" />
        </el-form-item>
        <el-form-item label="简介" required>
          <el-input v-model="form.bio" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="所属技艺条目" required>
          <el-select v-model="form.craftItemId" filterable placeholder="选择条目" class="w-full">
            <el-option v-for="item in itemOptions" :key="item.id" :label="item.name" :value="item.id" />
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
