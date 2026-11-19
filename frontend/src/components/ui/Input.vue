<script setup>
import { computed } from 'vue'
import { cn } from '../../lib/utils'

const props = defineProps({
  modelValue: [String, Number],
  type: { type: String, default: 'text' },
  placeholder: String,
  disabled: Boolean,
  class: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const classes = computed(() =>
  cn(
    'flex h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900',
    'placeholder:text-slate-400 transition-all duration-150',
    'focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10',
    'disabled:cursor-not-allowed disabled:opacity-50',
    props.class,
  ),
)
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="classes"
    @input="emit('update:modelValue', $event.target.value)"
  />
</template>
