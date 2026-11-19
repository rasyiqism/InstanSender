<script setup>
import { computed } from 'vue'
import { cn } from '../../lib/utils'

const props = defineProps({
  class: { type: String, default: '' },
})

const classes = computed(() =>
  cn(
    'rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-2xs transition-all duration-150',
    props.class,
  ),
)
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
