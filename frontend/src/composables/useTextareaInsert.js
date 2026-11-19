import { ref } from 'vue'

/**
 * Tracks the last-focused textarea so text (e.g. an emoji or a {name} token)
 * can be inserted at the cursor position rather than always appended.
 *
 * Usage:
 *   const { lastFocused, onFocus, insertAtCursor } = useTextareaInsert()
 *   // textarea:  @focus="onFocus"  (and bind its value to a reactive ref)
 *   insertAtCursor(textRef, '😀')
 *
 * @returns {{ lastFocused, onFocus, insertAtCursor }}
 */
export function useTextareaInsert() {
  const lastFocused = ref(null)

  function onFocus(e) {
    lastFocused.value = e.target
  }

  /**
   * Insert `text` at the cursor position of the last-focused textarea, then
   * restore focus + place the caret after the inserted text.
   *
   * @param {() => string} get - returns the current string value
   * @param {(v: string) => void} set - sets the new string value
   * @param {string} text - the text/emoji to insert
   */
  function insertAtCursor(get, set, text) {
    const el = lastFocused.value
    const current = get() ?? ''

    if (el && typeof el.selectionStart === 'number' && document.activeElement === el) {
      const start = el.selectionStart
      const end = el.selectionEnd
      set(current.slice(0, start) + text + current.slice(end))
      // Restore caret after Vue updates the DOM.
      requestAnimationFrame(() => {
        const pos = start + text.length
        el.focus()
        el.setSelectionRange(pos, pos)
      })
    } else {
      // No active selection — append to the end.
      set(current + text)
    }
  }

  return { lastFocused, onFocus, insertAtCursor }
}
