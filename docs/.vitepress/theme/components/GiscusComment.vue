<script setup lang="ts">
import Giscus from '@giscus/vue'
import { useData } from 'vitepress'

const { isDark } = useData()
</script>

<template>
  <div class="giscus-comment">
    <Giscus
      repo="leonyangdev/dsh-guide"
      repo-id="R_kgDOT37lVg"
      category="General"
      category-id="DIC_kwDOT37lVs4DDVXl"
      mapping="pathname"
      :strict="false"
      :reactions-enabled="true"
      :emit-metadata="false"
      input-position="top"
      lang="zh-CN"
      :theme="isDark ? 'dark' : 'light'"
      loading="lazy"
    />
  </div>
</template>

<style scoped>
.giscus-comment {
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--vp-c-divider);
}
</style>
