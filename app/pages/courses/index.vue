<script setup lang="ts">
/**
 * 课程列表（工单 #6）：已发布课程 + 登录用户的「我的课程」进度区。
 * 公开页面 Tailwind 手写（规格 #1 前端决策），与技艺条目列表同风格。
 */
useHead({ title: '课程 · 薪火', htmlAttrs: { lang: 'zh-CN' } })

interface CourseSummary {
  id: string
  title: string
  intro: string
  craftItemId: string
  craftItemName: string
  subcategory: string
  stepCount: number
}

interface MyCourse {
  courseId: string
  title: string
  craftItemName: string
  completedSteps: number
  totalSteps: number
}

const { data: courses } = await useFetch<{ items: CourseSummary[] }>('/api/courses', {
  default: () => ({ items: [] }),
})

// 登录态：与 AppHeader 共用 auth-me key（SSR 去重）；「我的课程」仅登录后展示
const { data: user } = await useFetch<{ id: number } | null>('/api/auth/me', {
  key: 'auth-me',
  default: () => null,
})

const myCourses = ref<MyCourse[]>([])
onMounted(async () => {
  if (!user.value) return
  myCourses.value = await $fetch<{ items: MyCourse[] }>('/api/me/courses')
    .then(body => body.items)
    .catch(() => [])
})

function percent(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100)
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10">
    <header>
      <h1 class="text-3xl font-bold">课程</h1>
      <p class="mt-2 text-stone-500">跟着传承人的分步图文课程，系统学习一门传统技艺。</p>
    </header>

    <!-- 我的课程（学习进度）：已完成步骤 / 总步骤 -->
    <section v-if="user && myCourses.length" class="mt-8">
      <h2 class="text-lg font-semibold">我的课程</h2>
      <div class="mt-3 space-y-3">
        <NuxtLink
          v-for="course in myCourses"
          :key="course.courseId"
          :to="`/courses/${course.courseId}`"
          class="block rounded-xl border border-stone-200 bg-white p-5 transition hover:border-orange-300"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="font-semibold">{{ course.title }}</h3>
              <p class="mt-1 text-sm text-stone-500">{{ course.craftItemName }}</p>
            </div>
            <span class="text-sm text-stone-500">已完成 {{ course.completedSteps }} / {{ course.totalSteps }} 步</span>
          </div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              class="h-full rounded-full bg-orange-500 transition-all"
              :style="{ width: `${percent(course.completedSteps, course.totalSteps)}%` }"
            />
          </div>
        </NuxtLink>
      </div>
    </section>

    <section class="mt-10">
      <h2 class="text-lg font-semibold">全部课程</h2>
      <div v-if="courses.items.length" class="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="course in courses.items"
          :key="course.id"
          :to="`/courses/${course.id}`"
          class="flex flex-col rounded-xl border border-stone-200 bg-white p-5 transition hover:border-orange-300 hover:shadow-sm"
        >
          <div class="flex items-center gap-2">
            <span class="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs text-orange-700">{{ course.craftItemName }}</span>
            <span class="text-xs text-stone-400">{{ course.subcategory }}</span>
          </div>
          <h3 class="mt-3 font-semibold">{{ course.title }}</h3>
          <p class="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-500">{{ course.intro }}</p>
          <span class="mt-auto pt-4 text-xs text-stone-400">{{ course.stepCount }} 个步骤</span>
        </NuxtLink>
      </div>
      <p v-else class="mt-4 rounded-xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-400">
        暂无已发布课程。
      </p>
    </section>
  </div>
</template>
