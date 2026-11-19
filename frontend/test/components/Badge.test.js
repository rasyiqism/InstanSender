import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Badge from '../../src/components/ui/Badge.vue'

describe('Badge Component (Frontend Unit)', () => {
  it('renders slot text', () => {
    const wrapper = mount(Badge, {
      slots: {
        default: 'Active',
      },
    })
    expect(wrapper.text()).toBe('Active')
  })

  it('applies variant styling', () => {
    const wrapper = mount(Badge, {
      props: {
        variant: 'success',
      },
      slots: {
        default: 'Online',
      },
    })
    expect(wrapper.classes()).toContain('bg-primary-50')
  })
})
