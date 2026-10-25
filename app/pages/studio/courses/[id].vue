<script setup lang="ts">
/**
 * 课程编辑器（传承人端，工单 #6 / 用户故事 16-17）：
 * 课程信息表单、步骤增删改与上下移排序、提交审核；仅草稿/已驳回状态可编辑。
 */
interface Step {
  id: string
  order: number
  title: string
  content: string
  imageUrl: string | null
}

interface StudioCourseDetail {
  id: string
  title: string
  intro: string
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED'
  craftItemId: string
  craftItemName: string
  stepCount: number
  rejectReason: string | null
  steps: Step[]
}

interface CraftItemOption { id: string, name: string }

const route = useRoute()
const requestFetch = useRequestFetch()

const course = ref<StudioCourseDetail | null>(null)
const loadError = ref('')
const savingInfo = ref(false)
const infoMessage = ref('')
const infoError = ref('')
const submitting = ref(false)
const submitError = ref('')

const editable = computed(() => course.value?.status === 'DRAFT' || course.value?.status === 'REJECTED')

const STATUS_META: Record<string, { label: string, class: string }> = {
  DRAFT: { label: '草稿', class: 'bg-stone-100 text-stone-500' },
  PENDING_REVIEW: { label: '待审核', class: 'bg-amber-50 text-amber-700' },
  PUBLISHED: { label: '已发布', class: 'bg-green-50 text-green-700' },
  REJECTED: { label: '已驳回', class: 'bg-red-50 text-red-700' },
}

async function loadCourse() {
  loadError.value = ''
  try {
    course.value = await requestFetch<StudioCourseDetail>(`/api/studio/courses/${route.params.id}`)
  }
  catch {
    throw createError({ statusCode: 404, statusMessage: '课程不存在', fatal: true })
  }
}

const { data: itemOptions } = await useFetch<{ items: CraftItemOption[] }>('/api/craft-items?pageSize=50', {
  default: () => ({ items: [] }),
})

// 课程信息表单（创建后回显）
const infoForm = reactive({ title: '', intro: '', craftItemId: '' })

watch(course, (value) => {
  if (value) {
    infoForm.title = value.title
    infoForm.intro = value.intro
    infoForm.craftItemId = value.craftItemId
  }
}, { immediate: true })

async function onSaveInfo() {
  infoError.value = ''
  infoMessage.value = ''
  if (!infoForm.title.trim() || !infoForm.intro.trim() || !infoForm.craftItemId) {
    infoError.value = '标题、简介与挂载条目均不能为空'
    return
  }
  savingInfo.value = true
  try {
    course.value = await requestFetch<StudioCourseDetail>(`/api/studio/courses/${course.value!.id}`, {
      method: 'PUT',
      body: {
        title: infoForm.title.trim(),
        intro: infoForm.intro.trim(),
        craftItemId: infoForm.craftItemId,
      },
    })
    infoMessage.value = '已保存'
  }
  catch (err) {
    infoError.value = apiErrorMessage(err)
  }
  finally {
    savingInfo.value = false
  }
}

async function onSubmitReview() {
  submitError.value = ''
  submitting.value = true
  try {
    course.value = await requestFetch<StudioCourseDetail>(`/api/studio/courses/${course.value!.id}/submit`, {
      method: 'POST',
    })
  }
  catch (err) {
    submitError.value = apiErrorMessage(err)
  }
  finally {
    submitting.value = false
  }
}

// ---- 步骤编辑 ----

const newStep = reactive({ title: '', content: '', imageUrl: '' })
const addingStep = ref(false)
const addStepError = ref('')

async function onAddStep() {
  addStepError.value = ''
  if (!newStep.title.trim() || !newStep.content.trim()) {
    addStepError.value = '步骤标题与内容不能为空'
    return
  }
  addingStep.value = true
  try {
    await requestFetch(`/api/studio/courses/${course.value!.id}/steps`, {
      method: 'POST',
      body: {
        title: newStep.title.trim(),
        content: newStep.content.trim(),
        ...(newStep.imageUrl.trim() ? { imageUrl: newStep.imageUrl.trim() } : {}),
      },
    })
    newStep.title = ''
    newStep.content = ''
    newStep.imageUrl = ''
    await loadCourse()
  }
  catch (err) {
    addStepError.value = apiErrorMessage(err)
  }
  finally {
    addingStep.value = false
  }
}

const editingStepId = ref<string | null>(null)
const editForm = reactive({ title: '', content: '', imageUrl: '' })
const savingStep = ref(false)

function startEditStep(step: Step) {
  editingStepId.value = step.id
  editForm.title = step.title
  editForm.content = step.content
  editForm.imageUrl = step.imageUrl ?? ''
}

async function onSaveStep() {
  if (!editingStepId.value) return
  savingStep.value = true
  try {
    await requestFetch(`/api/studio/courses/${course.value!.id}/steps/${editingStepId.value}`, {
      method: 'PUT',
      body: {
        title: editForm.title.trim(),
        content: editForm.content.trim(),
        imageUrl: editForm.imageUrl.trim() || null,
      },
    })
    editingStepId.value = null
    await loadCourse()
  }
  catch (err) {
    alert(apiErrorMessage(err))
  }
  finally {
    savingStep.value = false
  }
}

async function onDeleteStep(step: Step) {
  if (!confirm(`确定删除步骤「${step.title}」吗？`)) return
  try {
    await requestFetch(`/api/studio/courses/${course.value!.id}/steps/${step.id}`, { method: 'DELETE' })
    await loadCourse()
  }
  catch (err) {
    alert(apiErrorMessage(err))
  }
}

/** 上移/下移：交换相邻项后按全量顺序提交重排接口 */
async function onMove(index: number, direction: -1 | 1) {
  const steps = course.value!.steps
  const target = index + direction
  if (target < 0 || target >= steps.length) return
  const ids = steps.map(s => s.id)
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  try {
    await requestFetch(`/api/studio/courses/${course.value!.id}/steps/order`, {
      method: 'PUT',
      body: { stepIds: ids },
    })
    await loadCourse()
  }
  catch (err) {
    alert(apiErrorMessage(err))
  }
}

useHead({ title: '课程编辑 · 薪火', htmlAttrs: { lang: 'zh-CN' } })
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-10">
    <NuxtLink to="/studio" class="text-sm text-orange-600 hover:text-orange-700">← 返回创作中心</NuxtLink>

    <div v-if="loadError" class="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ loadError }}
    </div>

    <template v-if="course">
      <!-- 状态与提交 -->
      <header class="mt-4 flex flex-wrap items-center gap-3">
        <h1 class="text-2xl font-bold">{{ course.title }}</h1>
        <span class="rounded-full px-2.5 py-0.5 text-xs" :class="STATUS_META[course.status]?.class">
          {{ STATUS_META[course.status]?.label ?? course.status }}
        </span>
        <button
          v-if="editable"
          class="ml-auto rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="submitting"
          @click="onSubmitReview"
        >
          {{ submitting ? '提交中…' : '提交审核' }}
        </button>
      </header>
      <p v-if="course.status === 'REJECTED' && course.rejectReason" class="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
        驳回理由：{{ course.rejectReason }}
      </p>
      <p v-else-if="course.status === 'PENDING_REVIEW'" class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
        课程正在等待管理员审核，审核期间暂不可编辑。
      </p>
      <p v-else-if="course.status === 'PUBLISHED'" class="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
        课程已发布，学习者正在学习。内容如需修改请联系管理员。
      </p>
      <p v-if="submitError" class="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
        {{ submitError }}
      </p>

      <!-- 课程信息 -->
      <section class="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <h2 class="font-semibold">课程信息</h2>
        <div class="mt-4 space-y-4">
          <div>
            <label for="info-title" class="block text-sm font-medium text-stone-700">课程标题</label>
            <input
              id="info-title"
              v-model="infoForm.title"
              type="text"
              :disabled="!editable"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-stone-50 disabled:text-stone-400"
            >
          </div>
          <div>
            <label for="info-intro" class="block text-sm font-medium text-stone-700">课程简介</label>
            <textarea
              id="info-intro"
              v-model="infoForm.intro"
              rows="3"
              :disabled="!editable"
              class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-stone-50 disabled:text-stone-400"
            />
          </div>
          <div>
            <label for="info-item" class="block text-sm font-medium text-stone-700">挂载技艺条目</label>
            <select
              id="info-item"
              v-model="infoForm.craftItemId"
              :disabled="!editable"
              class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-stone-50 disabled:text-stone-400"
            >
              <option v-for="option in itemOptions.items" :key="option.id" :value="option.id">
                {{ option.name }}
              </option>
            </select>
          </div>
          <div v-if="editable" class="flex items-center gap-3">
            <button
              class="rounded-lg border border-orange-300 px-4 py-2 text-sm text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="savingInfo"
              @click="onSaveInfo"
            >
              {{ savingInfo ? '保存中…' : '保存信息' }}
            </button>
            <span v-if="infoMessage" class="text-sm text-green-600">{{ infoMessage }}</span>
            <span v-if="infoError" class="text-sm text-red-600">{{ infoError }}</span>
          </div>
        </div>
      </section>

      <!-- 步骤列表 -->
      <section class="mt-8">
        <h2 class="font-semibold">步骤（{{ course.steps.length }}）</h2>
        <ol class="mt-4 space-y-4">
          <li
            v-for="(step, index) in course.steps"
            :key="step.id"
            class="rounded-xl border border-stone-200 bg-white p-5"
          >
            <template v-if="editingStepId === step.id">
              <div class="space-y-3">
                <input
                  v-model="editForm.title"
                  type="text"
                  class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder="步骤标题"
                >
                <textarea
                  v-model="editForm.content"
                  rows="4"
                  class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder="步骤内容"
                />
                <input
                  v-model="editForm.imageUrl"
                  type="text"
                  class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder="配图地址（可选）"
                >
                <div class="flex gap-3">
                  <button
                    class="rounded-lg bg-orange-600 px-4 py-1.5 text-sm text-white transition hover:bg-orange-700 disabled:opacity-50"
                    :disabled="savingStep"
                    @click="onSaveStep"
                  >
                    {{ savingStep ? '保存中…' : '保存' }}
                  </button>
                  <button class="text-sm text-stone-500 hover:text-stone-700" @click="editingStepId = null">
                    取消
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="flex items-start gap-4">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm text-stone-500">
                  {{ step.order }}
                </span>
                <div class="min-w-0 flex-1">
                  <h3 class="font-medium">{{ step.title }}</h3>
                  <p class="mt-1 line-clamp-2 whitespace-pre-line text-sm text-stone-500">{{ step.content }}</p>
                </div>
                <div v-if="editable" class="flex shrink-0 items-center gap-1 text-sm">
                  <button
                    class="rounded px-2 py-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-30"
                    :disabled="index === 0"
                    aria-label="上移"
                    @click="onMove(index, -1)"
                  >
                    ↑
                  </button>
                  <button
                    class="rounded px-2 py-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-30"
                    :disabled="index === course.steps.length - 1"
                    aria-label="下移"
                    @click="onMove(index, 1)"
                  >
                    ↓
                  </button>
                  <button class="rounded px-2 py-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-700" @click="startEditStep(step)">
                    编辑
                  </button>
                  <button class="rounded px-2 py-1 text-red-400 transition hover:bg-red-50 hover:text-red-600" @click="onDeleteStep(step)">
                    删除
                  </button>
                </div>
              </div>
            </template>
          </li>
        </ol>
        <p v-if="!course.steps.length" class="mt-4 rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-400">
          还没有步骤，在下方添加第一个步骤（提交审核前至少需要一个步骤）。
        </p>

        <!-- 新增步骤 -->
        <form
          v-if="editable"
          class="mt-6 space-y-3 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-5"
          novalidate
          @submit.prevent="onAddStep"
        >
          <h3 class="text-sm font-medium text-stone-600">新增步骤</h3>
          <input
            v-model="newStep.title"
            type="text"
            class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            placeholder="步骤标题（如：揉泥、拉坯）"
          >
          <textarea
            v-model="newStep.content"
            rows="3"
            class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            placeholder="步骤内容：这道工序怎么做？"
          />
          <input
            v-model="newStep.imageUrl"
            type="text"
            class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            placeholder="配图地址（可选）"
          >
          <p v-if="addStepError" class="text-sm text-red-600" role="alert">{{ addStepError }}</p>
          <button
            type="submit"
            class="rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="addingStep"
          >
            {{ addingStep ? '添加中…' : '添加步骤' }}
          </button>
        </form>
      </section>
    </template>
  </div>
</template>
