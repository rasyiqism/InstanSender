<script setup>
import { computed } from 'vue'
import { cn } from '../../lib/utils'

const props = defineProps({
  variant: { type: String, default: 'default' },
  class: { type: String, default: '' },
})

const variants = {
  default: 'border border-transparent bg-slate-900 text-white shadow-2xs',
  secondary: 'border border-slate-200 bg-slate-100 text-slate-700',
  success:
    'border border-emerald-200 bg-emerald-50 bg-primary-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/50',
  warning:
    'border border-amber-200 bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/50',
  destructive:
    'border border-rose-200 bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200/50',
  outline: 'border border-slate-200 text-slate-800',
}

const classes = computed(() =>
  cn(
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none',
    variants[props.variant] ?? variants.default,
    props.class,
  ),
)
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>
