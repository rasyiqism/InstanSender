<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Smile } from 'lucide-vue-next'

const emit = defineEmits(['select'])

const open = ref(false)
const root = ref(null)
const activeCategory = ref('smileys')

function onDocumentClick(e) {
  if (open.value && root.value && !root.value.contains(e.target)) {
    open.value = false
  }
}

// A curated, dependency-free emoji set grouped by category.
// Categories follow common emoji keyboards; each entry is [emoji, name].
const categories = [
  {
    id: 'smileys',
    label: 'Smileys',
    emojis: [
      ['😀', 'grinning'], ['😃', 'smiley'], ['😄', 'smile'], ['😁', 'grin'],
      ['😆', 'laughing'], ['😅', 'sweat smile'], ['🤣', 'rofl'], ['😂', 'joy'],
      ['🙂', 'slight smile'], ['🙃', 'upside down'], ['😉', 'wink'], ['😊', 'blush'],
      ['😇', 'innocent'], ['🥰', 'smiling hearts'], ['😍', 'heart eyes'], ['🤩', 'star struck'],
      ['😘', 'kiss'], ['😗', 'kissing'], ['😚', 'kissing closed'], ['😙', 'kissing smiling'],
      ['😋', 'yum'], ['😛', 'tongue'], ['😜', 'wink tongue'], ['🤪', 'zany'],
      ['🤨', 'raised eyebrow'], ['🧐', 'monocle'], ['🤓', 'nerd'], ['😎', 'cool'],
      ['🥳', 'party'], ['🤗', 'hugging'], ['🤔', 'thinking'], ['🤭', 'hand over mouth'],
      ['🤫', 'shush'], ['🤥', 'lying'], ['😶', 'no mouth'], ['😐', 'neutral'],
      ['😑', 'expressionless'], ['😬', 'grimace'], ['🙄', 'eye roll'], ['😯', 'hushed'],
      ['😴', 'sleep'], ['😪', 'sleepy'], ['😌', 'relieved'], ['😔', 'pensive'],
      ['🥺', 'pleading'], ['😢', 'cry'], ['😭', 'sob'], ['😤', 'triumph'],
      ['😠', 'angry'], ['😡', 'pout'], ['🤬', 'cursing'], ['🤯', 'exploding head'],
      ['😈', 'smiling devil'], ['👿', 'angry devil'], ['💀', 'skull'], ['💩', 'poop'],
      ['🤡', 'clown'], ['👻', 'ghost'], ['👽', 'alien'], ['🤖', 'robot'],
    ],
  },
  {
    id: 'gestures',
    label: 'Gestures',
    emojis: [
      ['👍', 'thumbs up'], ['👎', 'thumbs down'], ['👌', 'ok'], ['🤌', 'pinched'],
      ['✌️', 'peace'], ['🤞', 'fingers crossed'], ['🤟', 'love you'], ['🤘', 'rock on'],
      ['🤙', 'call me'], ['👈', 'point left'], ['👉', 'point right'], ['👆', 'point up'],
      ['👇', 'point down'], ['☝️', 'index up'], ['👋', 'wave'], ['🤚', 'raised back'],
      ['🖐️', 'hand'], ['✋', 'stop'], ['🖖', 'vulcan'], ['👏', 'clap'],
      ['🙌', 'raised hands'], ['👐', 'open hands'], ['🤲', 'palms up'], ['🙏', 'pray'],
      ['🤝', 'handshake'], ['💪', 'muscle'], ['✍️', 'writing'], ['🫶', 'heart hands'],
    ],
  },
  {
    id: 'hearts',
    label: 'Hearts',
    emojis: [
      ['❤️', 'red heart'], ['🧡', 'orange heart'], ['💛', 'yellow heart'], ['💚', 'green heart'],
      ['💙', 'blue heart'], ['💜', 'purple heart'], ['🖤', 'black heart'], ['🤍', 'white heart'],
      ['🤎', 'brown heart'], ['💖', 'sparkling heart'], ['💗', 'growing heart'], ['💓', 'beating heart'],
      ['💞', 'revolving hearts'], ['💕', 'two hearts'], ['💟', 'heart decoration'], ['❣️', 'heart exclamation'],
      ['💔', 'broken heart'], ['❤️‍🔥', 'heart on fire'], ['💯', 'hundred'], ['🔥', 'fire'],
      ['✨', 'sparkles'], ['⭐', 'star'], ['🌟', 'glowing star'], ['💫', 'dizzy'],
      ['⚡', 'zap'], ['💥', 'collision'], ['🎉', 'party popper'], ['🎊', 'confetti ball'],
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    emojis: [
      ['💬', 'speech balloon'], ['💭', 'thought balloon'], ['📢', 'loudspeaker'], ['📣', 'megaphone'],
      ['📱', 'phone'], ['💻', 'laptop'], ['⏰', 'alarm'], ['📅', 'calendar'], ['📌', 'pushpin'],
      ['📎', 'paperclip'], ['✏️', 'pencil'], ['📝', 'memo'], ['📄', 'page'], ['📧', 'email'],
      ['🔔', 'bell'], ['🎁', 'gift'], ['💰', 'money bag'], ['💵', 'dollar'], ['💳', 'card'],
      ['🏆', 'trophy'], ['🥇', 'gold'], ['🎯', 'target'], ['🚀', 'rocket'], ['🛒', 'cart'],
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    emojis: [
      ['✅', 'check'], ['❌', 'cross'], ['❓', 'question'], ['❗', 'exclamation'],
      ['⚠️', 'warning'], ['🚫', 'prohibited'], ['💲', 'dollar sign'], ['💱', 'currency'],
      ['♻️', 'recycle'], ['❎', 'cross mark'], ['🆗', 'ok button'], ['🆕', 'new'],
      ['🆒', 'cool button'], ['🆓', 'free'], ['🔝', 'top'], ['🔜', 'soon'],
      ['➡️', 'right arrow'], ['⬅️', 'left arrow'], ['⬆️', 'up arrow'], ['⬇️', 'down arrow'],
      ['⏩', 'fast forward'], ['⏪', 'rewind'], ['🔄', 'refresh'], ['🔁', 'repeat'],
    ],
  },
]

const active = computed(
  () => categories.find((c) => c.id === activeCategory.value) ?? categories[0],
)

function toggle() {
  open.value = !open.value
}

function pick(emoji) {
  emit('select', emoji)
}

function onKeydown(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      :class="{ 'bg-slate-100 text-slate-700': open }"
      title="Sisipkan emoji"
      aria-label="Sisipkan emoji"
      @click="toggle"
    >
      <Smile class="h-4 w-4" />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="open"
        class="absolute right-0 top-9 z-60 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
      >
        <!-- Category tabs -->
        <div class="mb-2 flex gap-1 border-b border-slate-100 pb-2">
          <button
            v-for="cat in categories"
            :key="cat.id"
            type="button"
            class="flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
            :class="activeCategory === cat.id
              ? 'bg-primary-50 text-primary-700'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'"
            @click="activeCategory = cat.id"
          >
            {{ cat.label }}
          </button>
        </div>

        <!-- Emoji grid -->
        <div class="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto">
          <button
            v-for="[emoji, name] in active.emojis"
            :key="name"
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none transition-colors hover:bg-slate-100"
            :title="name"
            @click="pick(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
