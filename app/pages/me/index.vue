<script setup lang="ts">
/**
 * 个人中心（/me，工单 #8）：展示学习者画像标签 + 我的个性化推荐。
 * 未登录跳回 /login；无画像（冷启动/管道未跑）时给出引导文案，
 * 推荐区由服务端全站热门兜底，永远有内容。
 */
useHead({ title: '个人中心 · 薪火', htmlAttrs: { lang: 'zh-CN' } })

interface AuthUser {
  id: number
  username: string
  displayName: string
  role: string
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

// 未登录（401）→ data 为 null → 跳登录页
const { data: user } = await useFetch<AuthUser | null>('/api/auth/me', { default: () => null })
if (!user.value) {
  await navigateTo('/login', { replace: true })
}

const { data: feed } = await useFetch<RecommendationFeed | null>('/api/recommendations', {
  default: () => null,
})
</script>

<template>
  <div v-if="user" class="mx-auto max-w-5xl px-6 py-10">
    <header class="flex flex-wrap items-center gap-4 border-b border-stone-200 pb-8">
      <div
        class="flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-xl font-bold text-white"
      >
        {{ user.displayName.slice(0, 1) }}
      </div>
      <div class="mr-auto">
        <h1 class="text-2xl font-bold">{{ user.displayName }}</h1>
        <p class="mt-1 text-sm text-stone-500">@{{ user.username }}</p>
      </div>
      <div v-if="feed?.clusterLabel" class="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-center">
        <p class="text-xs text-stone-500">我的学习者画像</p>
        <p class="mt-1 text-lg font-bold text-orange-700">{{ feed.clusterLabel }}</p>
      </div>
    </header>

    <!-- 画像说明：标签来自离线聚类，可解释性优先 -->
    <p class="mt-6 rounded-xl border border-stone-200 bg-white p-5 text-sm leading-relaxed text-stone-600">
      <template v-if="feed?.clusterLabel">
        画像由平台对全体学习者的学习行为（浏览条目、学习课程、发帖评论）做聚类分析得出，
        每日凌晨自动更新一次；你的推荐正是基于这一画像与内容相似度生成。
      </template>
      <template v-else>
        画像生成中——继续浏览感兴趣的技艺条目、学习课程或参与交流，积累一些学习行为后，
        平台会在下一次离线计算时为你生成画像与个性化推荐。当前先看看全站热门吧。
      </template>
    </p>

    <div class="mt-10">
      <RecommendationSection :feed="feed" />
    </div>
  </div>
</template>
