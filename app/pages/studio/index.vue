<script setup lang="ts">
/**
 * 创作中心（传承人端，工单 #6 / 用户故事 15-17）：我的课程列表 + 新建课程。
 * 前台 Tailwind 手写（与管理后台的 Element Plus 区分，规格 #1 前端决策）。
 */
useHead({ title: '创作中心 · 薪火', htmlAttrs: { lang: 'zh-CN' } })

definePageMeta({ middleware: 'studio' })

interface StudioCourse {
  id: string
  title: string
  intro: string
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED'
  craftItemId: string
  craftItemName: string
  stepCount: number
  /** 详情页累计浏览量（用户故事 18） */
  viewCount: number
  /** 学习人数（START_COURSE 去重用户数，用户故事 18） */
  learnerCount: number
  rejectReason: string | null
  updatedAt: string
}

interface CraftItemOption { id: string, name: string }

const STATUS_META: Record<string, { label: string, class: string }> = {
  DRAFT: { label: '草稿', class: 'bg-stone-100 text-stone-500' },
  PENDING_REVIEW: { label: '待审核', class: 'bg-amber-50 text-amber-700' },
  PUBLISHED: { label: '已发布', class: 'bg-green-50 text-green-700' },
  REJECTED: { label: '已驳回', class: 'bg-red-50 text-red-700' },
}

const requestFetch = useRequestFetch()
const courses = ref<StudioCourse[]>([])
const loading = ref(true)

async function loadCourses() {
  loading.value = true
  try {
    const body = await requestFetch<{ items: StudioCourse[] }>('/api/studio/courses')
    courses.value = body.items
  }
  finally {
    loading.value = false
  }
}

// 条目选项（挂载目标）：取已发布条目
const { data: itemOptions } = await useFetch<{ items: CraftItemOption[] }>('/api/craft-items?pageSize=50', {
  default: () => ({ items: [] }),
})

// 新建课程表单
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const form = reactive({ title: '', intro: '', craftItemId: '' })

async function onCreate() {
  createError.value = ''
  if (!form.title.trim() || !form.intro.trim() || !form.craftItemId) {
    createError.value = '请填写课程标题、简介并选择技艺条目'
    return
  }
  creating.value = true
  try {
    const course = await requestFetch<{ id: string }>('/api/studio/courses', {
      method: 'POST',
      body: { title: form.title.trim(), intro: form.intro.trim(), craftItemId: form.craftItemId },
    })
    await navigateTo(`/studio/courses/${course.id}`)
  }
  catch (err) {
    createError.value = apiErrorMessage(err)
  }
  finally {
    creating.value = false
  }
}

onMounted(loadCourses)
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">创作中心</h1>
        <p class="mt-1 text-sm text-stone-500">把你的手艺编排成分步课程，交由平台审核后发布。</p>
      </div>
      <button
        class="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700"
        @click="showCreate = !showCreate"
      >
        {{ showCreate ? '收起新建' : '新建课程' }}
      </button>
    </header>

    <!-- 新建课程：标题 / 简介 / 挂载条目 -->
    <form
      v-if="showCreate"
      class="mt-6 space-y-4 rounded-xl border border-stone-200 bg-white p-6"
      novalidate
      @submit.prevent="onCreate"
    >
      <div>
        <label for="course-title" class="block text-sm font-medium text-stone-700">课程标题</label>
        <input
          id="course-title"
          v-model="form.title"
          type="text"
          class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          placeholder="如：紫砂壶制作入门"
        >
      </div>
      <div>
        <label for="course-intro" class="block text-sm font-medium text-stone-700">课程简介</label>
        <textarea
          id="course-intro"
          v-model="form.intro"
          rows="3"
          class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          placeholder="这门课程会学到什么？"
        />
      </div>
      <div>
        <label for="course-item" class="block text-sm font-medium text-stone-700">挂载技艺条目</label>
        <select
          id="course-item"
          v-model="form.craftItemId"
          class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
        >
          <option value="" disabled>请选择条目</option>
          <option v-for="option in itemOptions.items" :key="option.id" :value="option.id">
            {{ option.name }}
          </option>
        </select>
      </div>
      <p v-if="createError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
        {{ createError }}
      </p>
      <button
        type="submit"
        class="rounded-lg bg-orange-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="creating"
      >
        {{ creating ? '创建中…' : '创建草稿课程' }}
      </button>
    </form>

    <!-- 我的课程列表 -->
    <section class="mt-8">
      <div v-if="loading" class="text-sm text-stone-400">加载中…</div>
      <div v-else-if="courses.length" class="space-y-4">
        <NuxtLink
          v-for="course in courses"
          :key="course.id"
          :to="`/studio/courses/${course.id}`"
          class="block rounded-xl border border-stone-200 bg-white p-5 transition hover:border-orange-300"
        >
          <div class="flex flex-wrap items-center gap-3">
            <h3 class="font-semibold">{{ course.title }}</h3>
            <span class="rounded-full px-2.5 py-0.5 text-xs" :class="STATUS_META[course.status]?.class">
              {{ STATUS_META[course.status]?.label ?? course.status }}
            </span>
            <span class="ml-auto text-xs text-stone-400">{{ course.craftItemName }} · {{ course.stepCount }} 个步骤</span>
          </div>
          <p class="mt-2 line-clamp-2 text-sm text-stone-500">{{ course.intro }}</p>
          <!-- 传播效果两指标（用户故事 18）：浏览量 / 学习人数 -->
          <div class="mt-3 flex items-center gap-4 text-xs text-stone-500">
            <span class="inline-flex items-center gap-1">
              <span class="text-stone-400">浏览量</span>
              <span class="font-medium text-stone-700">{{ course.viewCount }}</span>
            </span>
            <span class="inline-flex items-center gap-1">
              <span class="text-stone-400">学习人数</span>
              <span class="font-medium text-stone-700">{{ course.learnerCount }}</span>
            </span>
          </div>
          <p v-if="course.status === 'REJECTED' && course.rejectReason" class="mt-2 text-sm text-red-600">
            驳回理由：{{ course.rejectReason }}
          </p>
        </NuxtLink>
      </div>
      <p v-else class="rounded-xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-400">
        还没有课程，点击右上角「新建课程」开始创作。
      </p>
    </section>
  </div>
</template>
