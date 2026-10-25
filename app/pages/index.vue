<script setup lang="ts">
interface PlatformStats {
  craftItemCount: number
  subcategoryCount: number
}

interface CraftListItem {
  id: string
  name: string
  subcategory: string
  region: string
  batch: string
  images: Array<{ url: string, credit: string }>
  tags: string[]
}

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

// 首页统计：SSR 阶段从 /api/stats 读取数据库计数（接入 → 业务 → 数据 三层贯通的可见证明）
const { data: stats } = await useFetch<PlatformStats>('/api/stats')

// 在线课程数：课程列表接口无分页（规模取舍），条目数即课程总数
const { data: courses } = await useFetch<{ items: Array<{ id: string }> }>('/api/courses')

// 精选技艺条目：取最近收录的 6 条已发布条目
const { data: featured } = await useFetch<{ items: CraftListItem[] }>('/api/craft-items', {
  query: { pageSize: 6 },
})

// 为你推荐（工单 #8）：登录学习者返回画像驱动的个性化结果，游客 401 → data 为 null → 区块不渲染
const { data: feed } = await useFetch<RecommendationFeed | null>('/api/recommendations', {
  default: () => null,
})

/** 三步学习路径（纯静态导流，门户叙事：看 → 学 → 聊） */
const journey = [
  { step: '看', title: '浏览技艺条目', desc: '按陶瓷、织绣、漆器等子类别，读历史渊源与工艺特色。', to: '/craft-items' },
  { step: '学', title: '跟着课程学一遍', desc: '传承人主讲的分步图文课程，标记进度、循序而进。', to: '/courses' },
  { step: '聊', title: '交流学习心得', desc: '在交流区发帖提问，与同好切磋手上功夫。', to: '/community' },
] as const

useHead({
  title: '薪火 · 非遗传统技艺数字化展示与学习平台',
  htmlAttrs: { lang: 'zh-CN' },
})
</script>

<template>
  <div>
    <!-- 英雄区：衬线大标题 + 双入口 -->
    <section class="relative overflow-hidden border-b border-stone-200">
      <div class="absolute inset-0 bg-gradient-to-b from-orange-50 via-orange-50/50 to-stone-50" aria-hidden="true">
        <!-- 装饰：暖色光晕与「火」字水印，纯 CSS，不加载资源 -->
        <div class="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-200/40 blur-3xl" />
        <div class="absolute -right-16 bottom-0 select-none font-display text-[16rem] leading-none text-orange-100/80">
          火
        </div>
      </div>
      <div class="relative mx-auto max-w-5xl px-6 py-24 text-center sm:py-28">
        <p class="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/70 px-4 py-1 text-xs text-orange-700">
          <span class="h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden="true" />
          国家级名录 · 人工精选 · 图文分步课程
        </p>
        <h1 class="mt-6 font-display text-5xl font-bold tracking-[0.15em] sm:text-6xl">
          薪<span class="text-orange-600">火</span>相传
        </h1>
        <p class="mx-auto mt-6 max-w-2xl leading-loose text-stone-600">
          非遗传统技艺数字化展示与学习平台——看懂一门技艺，跟着学一遍。
          收录国家级名录中的传统技艺，提供结构化分步课程与学习者交流社区。
        </p>
        <div class="mt-9 flex flex-wrap justify-center gap-4">
          <NuxtLink
            to="/craft-items"
            class="rounded-lg bg-orange-600 px-7 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-orange-700"
          >
            浏览技艺条目
          </NuxtLink>
          <NuxtLink
            to="/courses"
            class="rounded-lg border border-stone-300 bg-white/80 px-7 py-3 text-sm font-medium text-stone-700 transition hover:border-orange-400 hover:text-orange-700"
          >
            查看课程
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- 统计带：白底横排，衬线数字 -->
    <section class="border-b border-stone-200 bg-white">
      <dl class="mx-auto grid max-w-5xl grid-cols-3 divide-x divide-stone-100 px-6 py-8 text-center">
        <div>
          <dt class="text-xs text-stone-500">技艺条目</dt>
          <dd class="mt-1 font-display text-4xl font-bold text-orange-600">
            {{ stats?.craftItemCount ?? '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-stone-500">覆盖子类别</dt>
          <dd class="mt-1 font-display text-4xl font-bold text-orange-600">
            {{ stats?.subcategoryCount ?? '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-stone-500">在线课程</dt>
          <dd class="mt-1 font-display text-4xl font-bold text-orange-600">
            {{ courses?.items.length ?? '—' }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- 为你推荐（工单 #8）：仅登录学习者可见（个性化画像驱动），游客不渲染 -->
    <section v-if="feed" class="mx-auto max-w-5xl px-6 pt-14">
      <RecommendationSection :feed="feed" />
    </section>

    <!-- 精选技艺条目 -->
    <section class="mx-auto max-w-5xl px-6 py-16">
      <SectionHeading eyebrow="Collection" title="精选技艺条目">
        <template #action>
          <NuxtLink to="/craft-items" class="text-sm text-orange-600 transition hover:text-orange-700">
            查看全部 →
          </NuxtLink>
        </template>
      </SectionHeading>
      <div v-if="featured?.items.length" class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <CraftItemCard v-for="item in featured.items" :key="item.id" :item="item" />
      </div>
      <p v-else class="mt-8 rounded-xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-400">
        条目收录中，敬请期待。
      </p>
    </section>

    <!-- 三步学习路径（静态导流） -->
    <section class="border-t border-stone-200 bg-white">
      <div class="mx-auto max-w-5xl px-6 py-16">
        <SectionHeading eyebrow="How it works" title="三步，跟一门手艺走完" />
        <div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <NuxtLink
            v-for="item in journey"
            :key="item.step"
            :to="item.to"
            class="group rounded-xl border border-stone-200 bg-stone-50/60 p-6 transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-white hover:shadow-md"
          >
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-orange-600/10 font-display text-lg font-bold text-orange-700 transition group-hover:bg-orange-600 group-hover:text-white">
              {{ item.step }}
            </span>
            <h3 class="mt-4 font-semibold group-hover:text-orange-700">{{ item.title }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-stone-500">{{ item.desc }}</p>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
