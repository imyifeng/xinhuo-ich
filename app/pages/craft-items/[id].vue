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

/** 名录元信息（头部元信息行） */
const meta = computed(() => [
  { label: '名录批次', value: item.value?.batch },
  { label: '名录编号', value: item.value?.code },
  { label: '申报地区', value: item.value?.region },
].filter(entry => entry.value))

useHead({ title: `${item.value.name} · 薪火`, htmlAttrs: { lang: 'zh-CN' } })
</script>

<template>
  <article v-if="item">
    <!-- 头部带：名录元信息 + 衬线大标题 -->
    <header class="border-b border-stone-200 bg-gradient-to-b from-orange-50/70 to-stone-50">
      <div class="mx-auto max-w-5xl px-6 py-12">
        <nav class="text-xs text-stone-400" aria-label="面包屑">
          <NuxtLink to="/craft-items" class="transition hover:text-orange-600">技艺条目</NuxtLink>
          <span class="mx-1.5" aria-hidden="true">/</span>
          <span>{{ item.subcategory }}</span>
        </nav>
        <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 class="font-display text-4xl font-bold tracking-wide">{{ item.name }}</h1>
          <span class="rounded-full bg-orange-600/10 px-3 py-1 text-sm font-medium text-orange-700">{{ item.subcategory }}</span>
        </div>
        <dl class="mt-5 flex flex-wrap gap-x-8 gap-y-2">
          <div v-for="entry in meta" :key="entry.label" class="flex items-baseline gap-2">
            <dt class="text-xs text-stone-400">{{ entry.label }}</dt>
            <dd class="text-sm text-stone-700">{{ entry.value }}</dd>
          </div>
        </dl>
        <div v-if="item.tags.length" class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="tag in item.tags"
            :key="tag"
            class="rounded-md bg-white/80 px-2 py-0.5 text-xs text-stone-500 ring-1 ring-stone-200"
          >
            # {{ tag }}
          </span>
        </div>
      </div>
    </header>

    <div class="mx-auto max-w-5xl px-6 py-12">
      <div class="grid grid-cols-1 gap-12 lg:grid-cols-5">
        <div class="space-y-12 lg:col-span-3">
          <section>
            <h2 class="flex items-center gap-2.5 font-display text-xl font-bold tracking-wide">
              <span class="h-5 w-1 rounded-full bg-orange-600" aria-hidden="true" />
              历史渊源
            </h2>
            <p class="mt-4 leading-loose text-justify text-stone-700">{{ item.history }}</p>
          </section>

          <section>
            <h2 class="flex items-center gap-2.5 font-display text-xl font-bold tracking-wide">
              <span class="h-5 w-1 rounded-full bg-orange-600" aria-hidden="true" />
              工艺特色
            </h2>
            <p class="mt-4 leading-loose text-justify text-stone-700">{{ item.features }}</p>
          </section>

          <!-- 图集：4:3 统一纵横比，每图标注出处 -->
          <section v-if="item.images.length">
            <h2 class="flex items-center gap-2.5 font-display text-xl font-bold tracking-wide">
              <span class="h-5 w-1 rounded-full bg-orange-600" aria-hidden="true" />
              图集
            </h2>
            <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <figure
                v-for="(image, index) in item.images"
                :key="image.url"
                class="overflow-hidden rounded-xl border border-stone-200 bg-white"
              >
                <img :src="image.url" :alt="`${item.name} 图${index + 1}`" class="aspect-[4/3] w-full object-cover" loading="lazy">
                <figcaption class="border-t border-stone-100 px-3 py-2 text-xs text-stone-400">图片来源：{{ image.credit }}</figcaption>
              </figure>
            </div>
          </section>

          <!-- 视频外链（B 站） -->
          <section v-if="item.videoUrl">
            <h2 class="flex items-center gap-2.5 font-display text-xl font-bold tracking-wide">
              <span class="h-5 w-1 rounded-full bg-orange-600" aria-hidden="true" />
              影像记录
            </h2>
            <div v-if="bilibiliBV" class="mt-4 aspect-video overflow-hidden rounded-xl border border-stone-200 bg-black">
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
              class="mt-4 inline-block rounded-lg border border-orange-300 px-4 py-2 text-sm text-orange-700 transition hover:bg-orange-50"
            >
              在 B 站观看视频 ↗
            </a>
          </section>

          <!-- 相关课程（工单 #6）：挂在本条目下的已发布课程 -->
          <section v-if="relatedCourses.items.length">
            <h2 class="flex items-center gap-2.5 font-display text-xl font-bold tracking-wide">
              <span class="h-5 w-1 rounded-full bg-orange-600" aria-hidden="true" />
              相关课程
            </h2>
            <div class="mt-4 space-y-3">
              <NuxtLink
                v-for="course in relatedCourses.items"
                :key="course.id"
                :to="`/courses/${course.id}`"
                class="block rounded-xl border border-stone-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h3 class="font-semibold group-hover:text-orange-700">{{ course.title }}</h3>
                  <span class="text-xs text-stone-400">{{ course.stepCount }} 个步骤</span>
                </div>
                <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-500">{{ course.intro }}</p>
              </NuxtLink>
            </div>
          </section>
        </div>

        <!-- 传承人区块：桌面端随滚动驻留 -->
        <aside class="lg:col-span-2">
          <div class="space-y-4 lg:sticky lg:top-6">
            <h2 class="flex items-center gap-2.5 font-display text-xl font-bold tracking-wide">
              <span class="h-5 w-1 rounded-full bg-orange-600" aria-hidden="true" />
              代表性传承人
            </h2>
            <div v-if="item.inheritors.length" class="space-y-4">
              <div
                v-for="inheritor in item.inheritors"
                :key="inheritor.id"
                class="rounded-xl border border-stone-200 bg-white p-5"
              >
                <div class="flex items-center justify-between gap-2">
                  <h3 class="font-display text-lg font-bold tracking-wide">{{ inheritor.name }}</h3>
                  <span class="shrink-0 rounded-full bg-orange-600/10 px-2.5 py-0.5 text-xs text-orange-700">
                    {{ inheritor.level }}代表性传承人
                  </span>
                </div>
                <p class="mt-2 text-sm leading-relaxed text-justify text-stone-600">{{ inheritor.bio }}</p>
              </div>
            </div>
            <p v-else class="rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-400">
              暂无传承人信息。
            </p>

            <NuxtLink
              to="/craft-items"
              class="block rounded-xl border border-stone-200 bg-white px-5 py-3 text-center text-sm text-stone-600 transition hover:border-orange-300 hover:text-orange-700"
            >
              ← 返回技艺条目列表
            </NuxtLink>
          </div>
        </aside>
      </div>

      <!-- 为你推荐（工单 #8）：仅登录学习者可见 -->
      <section v-if="feed" class="mt-14 border-t border-stone-200 pt-12">
        <RecommendationSection :feed="feed" />
      </section>
    </div>
  </article>
</template>
