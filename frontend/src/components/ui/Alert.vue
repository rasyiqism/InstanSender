<script setup>
import { computed } from 'vue'
import { cn } from '../../lib/utils'

const props = defineProps({
  variant: { type: String, default: 'default' },
  class: { type: String, default: '' },
})

const variants = {
  default: 'bg-white text-slate-900 border-slate-200 shadow-2xs',
  destructive: 'border-rose-200 bg-rose-50 text-rose-800 shadow-2xs',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-2xs',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 shadow-2xs',
  info: 'border-indigo-200 bg-indigo-50 text-indigo-800 shadow-2xs',
}

const classes = computed(() =>
  cn(
    'relative w-full rounded-xl border p-4 text-sm [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-current',
    variants[props.variant] ?? variants.default,
    props.class,
  ),
)
</script>

<template>
  <div :class="classes" role="alert">
    <slot />
  </div>
</template>
