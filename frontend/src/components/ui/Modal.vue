<script setup>
import { computed } from 'vue'
import Card from './Card.vue'
import Button from './Button.vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  variant: { type: String, default: 'info' },
  icon: { type: [Object, Function], default: null },
  closeText: { type: String, default: 'Tutup' },
  bare: { type: Boolean, default: false },
  class: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const tileClasses = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
    case 'destructive':
      return 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
    case 'warning':
      return 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
    default:
      return 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200'
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 max-sm:items-end max-sm:p-0"
        @click.self="emit('close')"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-4 max-sm:translate-y-full scale-95"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 translate-y-4 max-sm:translate-y-full scale-95"
          appear
        >
          <Card
            class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-xl border-slate-200/90 max-sm:max-h-[85vh] max-sm:rounded-b-none max-sm:rounded-t-3xl"
            :class="props.class"
          >
            <!-- Mobile drag handle pill -->
            <div class="hidden max-sm:flex justify-center pt-2.5 pb-1">
              <span class="h-1.5 w-10 rounded-full bg-slate-300"></span>
            </div>

            <!-- Header -->
            <div class="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-white/95 backdrop-blur-xs px-5 py-3.5">
              <h3 class="font-bold text-slate-900 tracking-tight text-base">{{ title }}</h3>
              <Button variant="ghost" size="icon" @click="emit('close')" aria-label="Close">
                <X class="h-4 w-4" />
              </Button>
            </div>

            <!-- Body -->
            <div class="p-5">
              <div v-if="icon || $slots.icon" class="flex items-start gap-3">
                <div
                  v-if="icon"
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  :class="tileClasses"
                >
                  <component :is="icon" class="h-5 w-5" />
                </div>
                <slot name="icon" />
                <div class="min-w-0 flex-1">
                  <slot />
                </div>
              </div>
              <div v-else>
                <slot />
              </div>

              <!-- Footer -->
              <div v-if="!bare" class="mt-5 flex justify-end gap-2">
                <slot name="footer">
                  <Button variant="outline" @click="emit('close')">{{ closeText }}</Button>
                </slot>
              </div>
            </div>
          </Card>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
