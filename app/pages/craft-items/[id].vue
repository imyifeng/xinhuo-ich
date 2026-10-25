<script setup lang="ts">
interface CraftItemDetail {
  id: string
  name: string
  subcategory: string
  batch: string
  code: string
  region: string
  history: string
  features: string
  images: Array<{ url: string, credit: string }>
  videoUrl: string | null
  tags: string[]
  inheritors: Array<{ id: string, name: string, level: string, bio: string }>
}

const route = useRoute()

const { data: item, error } = await useFetch<CraftItemDetail>(`/api/craft-items/${route.params.id}`)

if (error.value || !item.value) {
  throw createError({ statusCode: 404, statusMessage: '技艺条目不存在', fatal: true })
}

// 为你推荐（工单 #8）：登录学习者返回画像驱动的个性化结果，游客 401 → null → 区块不渲染
interface RecommendationFeed {
  clusterLabel: string | null
  entries: Array<{
    type: 'CRAFT_ITEM' | 'COURSE'
    craftItemId: string | null
    courseId: string | null
    title: string
    subtitle: string
    image: { url: string, credit: string } | null
    reason: string
  }>
}
const { data: feed } = await useFetch<RecommendationFeed | null>('/api/recommendations', {
  default: () => null,
})

// 相关课程（工单 #6）：本条目下已发布的课程，引导学习者进入学习竖切
interface CourseSummary {
  id: string
  title: string
  intro: string
  stepCount: number
}
const { data: relatedCourses } = await useFetch<{ items: CourseSummary[] }>(`/api/courses?craftItemId=${route.params.id}`, {
  default: () => ({ items: [] }),
})

// B 站外链转内嵌播放器（仅识别标准 BV 号链接，其余以外部链接呈现）
const bilibiliBV = computed(() => {
  const url = item.value?.videoUrl
  if (!url) return null
  return url.match(/BV[0-9A-Za-z]{8,}/)?.[0] ?? null
})

useHead({ title: `${item.value.name} · 薪火`, htmlAttrs: { lang: 'zh-CN' } })
</script>

<template>
  <article v-if="item" class="mx-auto max-w-5xl px-6 py-10">
    <!-- 头部：名称与名录信息 -->
    <header class="border-b border-stone-200 pb-8">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-3xl font-bold">{{ item.name }}</h1>
        <span class="rounded-full bg-orange-50 px-3 py-1 text-sm text-orange-700">{{ item.subcategory }}</span>
      </div>
      <dl class="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-stone-600 sm:grid-cols-3">
        <div class="flex gap-2">
          <dt class="shrink-0 text-stone-400">名录批次</dt>
          <dd>{{ item.batch }}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="shrink-0 text-stone-400">名录编号</dt>
          <dd>{{ item.code }}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="shrink-0 text-stone-400">申报地区</dt>
          <dd>{{ item.region }}</dd>
        </div>
      </dl>
      <div v-if="item.tags.length" class="mt-4 flex flex-wrap gap-2">
        <span
          v-for="tag in item.tags"
          :key="tag"
          class="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-500"
        >
          # {{ tag }}
        </span>
      </div>
    </header>

    <div class="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-5">
      <div class="space-y-10 lg:col-span-3">
        <section>
          <h2 class="text-lg font-semibold">历史渊源</h2>
          <p class="mt-3 leading-loose text-stone-700">{{ item.history }}</p>
        </section>

        <section>
          <h2 class="text-lg font-semibold">工艺特色</h2>
          <p class="mt-3 leading-loose text-stone-700">{{ item.features }}</p>
        </section>

        <!-- 图集：每图标注出处 -->
        <section v-if="item.images.length">
          <h2 class="text-lg font-semibold">图集</h2>
          <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <figure
              v-for="(image, index) in item.images"
              :key="image.url"
              class="overflow-hidden rounded-lg border border-stone-200 bg-white"
            >
              <img :src="image.url" :alt="`${item.name} 图${index + 1}`" class="aspect-[4/3] w-full object-cover" loading="lazy">
              <figcaption class="px-3 py-2 text-xs text-stone-400">图片来源：{{ image.credit }}</figcaption>
            </figure>
          </div>
        </section>

        <!-- 视频外链（B 站） -->
        <section v-if="item.videoUrl">
          <h2 class="text-lg font-semibold">影像记录</h2>
          <div v-if="bilibiliBV" class="mt-3 aspect-video overflow-hidden rounded-lg border border-stone-200 bg-black">
            <iframe
              :src="`https://player.bilibili.com/player.html?bvid=${bilibiliBV}&autoplay=0&danmaku=0`"
              :title="`${item.name} 视频`"
              class="h-full w-full"
              scrolling="no"
              frameborder="0"
              allowfullscreen
            />
          </div>
          <a
            v-else
            :href="item.videoUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-3 inline-block rounded-lg border border-orange-300 px-4 py-2 text-sm text-orange-700 transition hover:bg-orange-50"
          >
            在 B 站观看视频 ↗
          </a>
        </section>

        <!-- 相关课程（工单 #6）：挂在本条目下的已发布课程 -->
        <section v-if="relatedCourses.items.length">
          <h2 class="text-lg font-semibold">相关课程</h2>
          <div class="mt-3 space-y-3">
            <NuxtLink
              v-for="course in relatedCourses.items"
              :key="course.id"
              :to="`/courses/${course.id}`"
              class="block rounded-xl border border-stone-200 bg-white p-5 transition hover:border-orange-300"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="font-semibold">{{ course.title }}</h3>
                <span class="text-xs text-stone-400">{{ course.stepCount }} 个步骤</span>
              </div>
              <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-500">{{ course.intro }}</p>
            </NuxtLink>
          </div>
        </section>
      </div>

      <!-- 传承人区块 -->
      <aside class="lg:col-span-2">
        <h2 class="text-lg font-semibold">代表性传承人</h2>
        <div v-if="item.inheritors.length" class="mt-3 space-y-4">
          <div
            v-for="inheritor in item.inheritors"
            :key="inheritor.id"
            class="rounded-xl border border-stone-200 bg-white p-5"
          >
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold">{{ inheritor.name }}</h3>
              <span class="shrink-0 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs text-orange-700">
                {{ inheritor.level }}代表性传承人
              </span>
            </div>
            <p class="mt-2 text-sm leading-relaxed text-stone-600">{{ inheritor.bio }}</p>
          </div>
        </div>
        <p v-else class="mt-3 rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-400">
          暂无传承人信息。
        </p>
      </aside>
    </div>

    <!-- 为你推荐（工单 #8）：仅登录学习者可见 -->
    <section v-if="feed" class="mt-12 border-t border-stone-200 pt-10">
      <RecommendationSection :feed="feed" />
    </section>

    <div class="mt-12 border-t border-stone-200 pt-6">
      <NuxtLink to="/craft-items" class="text-sm text-orange-600 hover:text-orange-700">← 返回技艺条目列表</NuxtLink>
    </div>
  </article>
</template>
