<script setup>
import { computed } from 'vue'
import { cn } from '../../lib/utils'

const props = defineProps({
  type: { type: String, default: 'button' },
  variant: { type: String, default: 'default' },
  size: { type: String, default: 'default' },
  disabled: { type: Boolean, default: false },
  class: { type: String, default: '' },
})

const variants = {
  default:
    'bg-slate-900 text-white shadow-2xs hover:bg-slate-800 active:bg-slate-950 focus-visible:outline-slate-900',
  primary:
    'bg-slate-900 text-white shadow-2xs hover:bg-slate-800 active:bg-slate-950 focus-visible:outline-slate-900',
  secondary:
    'bg-white text-slate-800 border border-slate-200/90 shadow-2xs hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100',
  outline:
    'border border-slate-200/90 bg-white text-slate-800 shadow-2xs hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900',
  destructive:
    'bg-red-600 text-white shadow-2xs hover:bg-red-700 active:bg-red-800 focus-visible:outline-red-600',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 shadow-none',
  link:
    'text-slate-900 underline-offset-4 hover:underline shadow-none',
}

const sizes = {
  default: 'h-10 px-4 py-2 text-sm',
  sm: 'h-8 rounded-lg px-3 text-xs',
  lg: 'h-11 rounded-xl px-6 text-base',
  icon: 'h-9 w-9 p-0',
}

const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium cursor-pointer',
    'transition-all duration-150 ease-out',
    'hover:scale-[1.01] active:scale-[0.98]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
    'disabled:pointer-events-none disabled:opacity-50 disabled:hover:scale-100',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    variants[props.variant] ?? variants.default,
    sizes[props.size] ?? sizes.default,
    props.class,
  ),
)
</script>

<template>
  <button :type="type" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>
