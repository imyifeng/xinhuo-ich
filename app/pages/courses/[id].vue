<script setup lang="ts">
/**
 * 课程详情（工单 #6 / 用户故事 4、10-12）：
 * 步骤按序浏览、标记完成、进度条；游客可预览大纲，开始学习时引导登录。
 */
interface CourseStep {
  id: string
  order: number
  title: string
  content: string | null
  imageUrl: string | null
  completed?: boolean
}

interface CourseDetail {
  id: string
  title: string
  intro: string
  craftItem: { id: string, name: string, subcategory: string }
  steps: CourseStep[]
  progress: { completedSteps: number, totalSteps: number } | null
}

const route = useRoute()
// SSR 阶段透传 Cookie（普通 $fetch 不转发），保证登录用户直接拿到带内容的详情
const requestFetch = useRequestFetch()

const { data: user } = await useFetch<{ id: number } | null>('/api/auth/me', {
  key: 'auth-me',
  default: () => null,
})

const { data: course, error, refresh } = await useFetch<CourseDetail>(`/api/courses/${route.params.id}`)

if (error.value || !course.value) {
  throw createError({ statusCode: 404, statusMessage: '课程不存在', fatal: true })
}

const percent = computed(() => {
  const progress = course.value?.progress
  if (!progress || progress.totalSteps === 0) return 0
  return Math.round((progress.completedSteps / progress.totalSteps) * 100)
})

const starting = ref(false)
const markingStepId = ref<string | null>(null)

/** 开始学习：未登录引导登录（登录后 redirect 回本页）；已登录则幂等记 START_COURSE */
async function onStart() {
  if (!user.value) {
    await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  starting.value = true
  try {
    await requestFetch(`/api/courses/${course.value!.id}/start`, { method: 'POST' })
    await refresh()
  }
  catch (err) {
    alert(apiErrorMessage(err))
  }
  finally {
    starting.value = false
  }
}

/** 标记步骤完成：learning_record 幂等，完成后刷新进度 */
async function onComplete(step: CourseStep) {
  markingStepId.value = step.id
  try {
    await requestFetch(`/api/courses/${course.value!.id}/steps/${step.id}/complete`, { method: 'POST' })
    await refresh()
  }
  catch (err) {
    alert(apiErrorMessage(err))
  }
  finally {
    markingStepId.value = null
  }
}

useHead({ title: `${course.value.title} · 薪火`, htmlAttrs: { lang: 'zh-CN' } })
</script>

<template>
  <article v-if="course" class="mx-auto max-w-4xl px-6 py-10">
    <!-- 头部：标题与所属条目 -->
    <header class="border-b border-stone-200 pb-8">
      <NuxtLink :to="`/craft-items/${course.craftItem.id}`" class="text-sm text-orange-600 hover:text-orange-700">
        {{ course.craftItem.name }} · {{ course.craftItem.subcategory }}
      </NuxtLink>
      <h1 class="mt-2 text-3xl font-bold">{{ course.title }}</h1>
      <p class="mt-3 leading-loose text-stone-600">{{ course.intro }}</p>
      <p class="mt-3 text-sm text-stone-400">共 {{ course.steps.length }} 个步骤</p>
    </header>

    <!-- 学习进度（登录用户） -->
    <section v-if="course.progress" class="mt-8 rounded-xl border border-stone-200 bg-white p-5">
      <div class="flex items-center justify-between gap-4">
        <h2 class="font-semibold">学习进度</h2>
        <span class="text-sm text-stone-500">{{ course.progress.completedSteps }} / {{ course.progress.totalSteps }} 步已完成</span>
      </div>
      <div class="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
        <div class="h-full rounded-full bg-orange-500 transition-all" :style="{ width: `${percent}%` }" />
      </div>
    </section>
    <section v-else class="mt-8 rounded-xl border border-dashed border-orange-300 bg-orange-50 p-5 text-sm text-stone-600">
      登录后可开始学习、标记步骤完成并记录学习进度。
    </section>

    <!-- 步骤列表：按 order 顺序浏览 -->
    <ol class="mt-8 space-y-5">
      <li
        v-for="step in course.steps"
        :key="step.id"
        class="rounded-xl border bg-white p-6"
        :class="step.completed ? 'border-orange-300' : 'border-stone-200'"
      >
        <div class="flex items-start gap-4">
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            :class="step.completed ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-500'"
          >
            {{ step.completed ? '✓' : step.order }}
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold">{{ step.title }}</h3>
            <!-- 游客仅见大纲（用户故事 4）；登录后展示全文 -->
            <p v-if="step.content" class="mt-2 whitespace-pre-line leading-loose text-stone-700">{{ step.content }}</p>
            <p v-else class="mt-2 text-sm text-stone-400">登录后可查看本步骤的详细内容。</p>
            <img
              v-if="step.imageUrl"
              :src="step.imageUrl"
              :alt="`${step.title} 配图`"
              class="mt-4 max-h-96 w-full rounded-lg border border-stone-200 object-cover"
              loading="lazy"
            >
          </div>
          <!-- 完成标记：仅登录用户；已完成的步骤显示对勾（重复点击幂等） -->
          <div v-if="user && step.content !== null" class="shrink-0">
            <button
              v-if="!step.completed"
              class="rounded-lg border border-orange-300 px-3 py-1.5 text-sm text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="markingStepId === step.id"
              @click="onComplete(step)"
            >
              {{ markingStepId === step.id ? '标记中…' : '标记完成' }}
            </button>
            <span v-else class="text-sm text-orange-600">已完成</span>
          </div>
        </div>
      </li>
    </ol>

    <!-- 开始/继续学习 -->
    <div class="mt-10 flex justify-center">
      <button
        v-if="!course.progress || course.progress.completedSteps < course.progress.totalSteps"
        class="rounded-lg bg-orange-600 px-8 py-3 font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="starting"
        @click="onStart"
      >
        {{ starting ? '处理中…' : course.progress && course.progress.completedSteps > 0 ? '继续学习' : '开始学习' }}
      </button>
      <p v-else class="rounded-lg bg-green-50 px-8 py-3 font-medium text-green-700">
        恭喜，你已完成本课程的全部步骤！
      </p>
    </div>

    <div class="mt-12 border-t border-stone-200 pt-6">
      <NuxtLink to="/courses" class="text-sm text-orange-600 hover:text-orange-700">← 返回课程列表</NuxtLink>
    </div>
  </article>
</template>
