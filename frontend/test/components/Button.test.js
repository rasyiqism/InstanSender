import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '../../src/components/ui/Button.vue'

describe('Button Component (Frontend Unit)', () => {
  it('renders default button with slot text', () => {
    const wrapper = mount(Button, {
      slots: {
        default: 'Click Me',
      },
    })
    expect(wrapper.text()).toBe('Click Me')
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('renders with custom variant and size', () => {
    const wrapper = mount(Button, {
      props: {
        variant: 'destructive',
        size: 'sm',
      },
      slots: {
        default: 'Delete',
      },
    })
    expect(wrapper.classes()).toContain('bg-red-600')
    expect(wrapper.classes()).toContain('h-8')
  })

  it('handles disabled state', () => {
    const wrapper = mount(Button, {
      props: {
        disabled: true,
      },
      slots: {
        default: 'Disabled Button',
      },
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
