<script setup lang="ts">
/**
 * 画像统计（管理端，工单 #8 / 用户故事 26）：平台用户数与学习行为量卡片
 * + 各簇人数分布 + 特征均值表 + 手动触发重建。
 * 特征均值表是实践报告 5.1 的核心素材：展示每个簇在各特征维度上的均值，
 * 可解释"这一簇为什么被命名为 XX爱好者型"。
 */
useHead({ title: '画像统计 · 薪火' })

definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ClusterFeatureMean {
  dimension: string
  value: number
}

interface ProfileStats {
  /** 用户总数，按角色分（GLOSSARY：学习者/传承人/管理员，用户故事 26） */
  users: {
    total: number
    byRole: { LEARNER: number, INHERITOR: number, ADMIN: number }
  }
  /** 学习行为总量：五类事件按类型计数（用户故事 26/27） */
  behavior: {
    total: number
    byType: { VIEW_ITEM: number, START_COURSE: number, COMPLETE_STEP: number, CREATE_POST: number, CREATE_COMMENT: number }
  }
  totalProfiles: number
  clusters: Array<{
    clusterIndex: number
    label: string
    size: number
    featureMeans: ClusterFeatureMean[]
  }>
  lastRebuiltAt: string | null
}

interface RebuildResult {
  learnerCount: number
  profileCount: number
  chosenK: number | null
  clusters: Array<{ clusterIndex: number, label: string, size: number }>
  recommendationCount: number
  skippedClustering: boolean
}

const stats = ref<ProfileStats | null>(null)
const loading = ref(false)
const rebuilding = ref(false)
const lastRebuildSummary = ref<RebuildResult | null>(null)

async function loadStats() {
  loading.value = true
  try {
    stats.value = await $fetch<ProfileStats>('/api/admin/profiles/stats')
  }
  finally {
    loading.value = false
  }
}

async function onRebuild() {
  rebuilding.value = true
  try {
    lastRebuildSummary.value = await $fetch<RebuildResult>('/api/admin/profiles/rebuild', { method: 'POST' })
    ElMessage.success(`重建完成：画像 ${lastRebuildSummary.value.profileCount} 份、推荐 ${lastRebuildSummary.value.recommendationCount} 条`)
    await loadStats()
  }
  catch (err) {
    ElMessage.error(apiErrorMessage(err))
  }
  finally {
    rebuilding.value = false
  }
}

/** 特征均值表：行 = 特征维度，列 = 各簇（维度清单取特征均值最全的一簇） */
const dimensionRows = computed(() => {
  const clusters = stats.value?.clusters ?? []
  const richest = clusters.reduce(
    (best, cluster) => (cluster.featureMeans.length > best.length ? cluster.featureMeans : best),
    clusters[0]?.featureMeans ?? [],
  )
  return richest.map((mean, index) => {
    const row: Record<string, number | string> = { dimension: mean.dimension }
    for (const cluster of clusters) {
      row[`cluster_${cluster.clusterIndex}`] = cluster.featureMeans[index]?.value ?? 0
    }
    return row
  })
})

onMounted(loadStats)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="mr-auto text-xl font-bold">画像统计</h1>
      <span v-if="stats?.lastRebuiltAt" class="text-sm text-stone-400">
        最近重建：{{ new Date(stats.lastRebuiltAt).toLocaleString('zh-CN') }}
      </span>
      <el-button type="primary" :loading="rebuilding" @click="onRebuild">
        {{ rebuilding ? '重建中…' : '手动触发重建' }}
      </el-button>
    </div>

    <!-- 平台统计（用户故事 26）：用户数与行为量卡片，与簇分布同屏 -->
    <div>
      <h2 class="mb-3 text-base font-semibold">平台用户</h2>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <el-card shadow="never">
          <el-statistic title="用户总数" :value="stats?.users?.total ?? 0" />
        </el-card>
        <el-card shadow="never">
          <el-statistic title="学习者（LEARNER）" :value="stats?.users?.byRole?.LEARNER ?? 0" />
        </el-card>
        <el-card shadow="never">
          <el-statistic title="传承人（INHERITOR）" :value="stats?.users?.byRole?.INHERITOR ?? 0" />
        </el-card>
        <el-card shadow="never">
          <el-statistic title="管理员（ADMIN）" :value="stats?.users?.byRole?.ADMIN ?? 0" />
        </el-card>
      </div>
    </div>

    <div>
      <h2 class="mb-3 text-base font-semibold">学习行为量</h2>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <el-card shadow="never">
          <el-statistic title="行为总量" :value="stats?.behavior?.total ?? 0" />
        </el-card>
        <el-card shadow="never">
          <el-statistic title="浏览条目" :value="stats?.behavior?.byType?.VIEW_ITEM ?? 0" />
        </el-card>
        <el-card shadow="never">
          <el-statistic title="开始课程" :value="stats?.behavior?.byType?.START_COURSE ?? 0" />
        </el-card>
        <el-card shadow="never">
          <el-statistic title="完成步骤" :value="stats?.behavior?.byType?.COMPLETE_STEP ?? 0" />
        </el-card>
        <el-card shadow="never">
          <el-statistic title="发帖" :value="stats?.behavior?.byType?.CREATE_POST ?? 0" />
        </el-card>
        <el-card shadow="never">
          <el-statistic title="评论" :value="stats?.behavior?.byType?.CREATE_COMMENT ?? 0" />
        </el-card>
      </div>
    </div>

    <!-- 概览卡片：画像总数 / 簇数 -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <el-card shadow="never">
        <el-statistic title="画像总数（有画像的学习者）" :value="stats?.totalProfiles ?? 0" />
      </el-card>
      <el-card shadow="never">
        <el-statistic title="画像簇数（手肘法选出 k）" :value="stats?.clusters.length ?? 0" />
      </el-card>
    </div>

    <!-- 上次手动重建结果摘要 -->
    <el-alert
      v-if="lastRebuildSummary"
      type="success"
      :closable="false"
      show-icon
    >
      <template #title>
        重建结果：学习者 {{ lastRebuildSummary.learnerCount }} 人，k = {{ lastRebuildSummary.chosenK ?? '—' }}
        <template v-if="lastRebuildSummary.skippedClustering">（学习者不足 4 人，跳过聚类，仅热门兜底）</template>，
        推荐 {{ lastRebuildSummary.recommendationCount }} 条：
        {{ lastRebuildSummary.clusters.map(cluster => `${cluster.label} ${cluster.size} 人`).join('；') || '无簇' }}
      </template>
    </el-alert>

    <!-- 各簇人数分布 -->
    <div>
      <h2 class="mb-3 text-base font-semibold">各簇人数分布</h2>
      <el-table v-loading="loading" :data="stats?.clusters ?? []" border stripe>
        <el-table-column prop="clusterIndex" label="簇编号" width="90" />
        <el-table-column prop="label" label="画像标签" min-width="180" />
        <el-table-column prop="size" label="人数" width="90" />
        <el-table-column label="占比" min-width="160">
          <template #default="{ row }">
            <el-progress
              :percentage="stats && stats.totalProfiles > 0
                ? Math.round((row.size / stats.totalProfiles) * 100)
                : 0"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 特征均值表（报告 5.1 素材）：每一簇在各特征维度上的均值 -->
    <div>
      <h2 class="mb-1 text-base font-semibold">特征均值表</h2>
      <p class="mb-3 text-xs text-stone-400">
        行为特征维度（各子类别浏览占比 / 各课程学习进度 / 发帖评论活跃度）在每个簇内的均值，用于解释簇标签的命名来源。
      </p>
      <el-table v-loading="loading" :data="dimensionRows" border stripe>
        <el-table-column prop="dimension" label="特征维度" min-width="220" />
        <el-table-column
          v-for="cluster in stats?.clusters ?? []"
          :key="cluster.clusterIndex"
          :label="`${cluster.label}（${cluster.size} 人）`"
          min-width="150"
        >
          <template #default="{ row }">
            {{ (row[`cluster_${cluster.clusterIndex}`] as number).toFixed(3) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
