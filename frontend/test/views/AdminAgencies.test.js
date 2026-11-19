import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import api from '../../src/services/api'
import AdminAgencies from '../../src/views/admin/AdminAgencies.vue'

vi.mock('../../src/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

describe('AdminAgencies View (Component Test)', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  it('mounts cleanly with Button component and renders agencies', async () => {
    api.get.mockResolvedValueOnce({
      data: [
        {
          id: 'agency-12345678',
          name: 'Digital Agency Pro',
          status: 'active',
          owner: {
            id: 'user-1',
            email: 'owner@agency.com',
            name: 'Owner Budi',
          },
        },
      ],
    })

    const wrapper = mount(AdminAgencies, {
      global: {
        plugins: [pinia],
      },
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(wrapper.text()).toContain('Agencies')
    expect(wrapper.text()).toContain('Digital Agency Pro')
    expect(wrapper.text()).toContain('owner@agency.com')
    expect(wrapper.find('button').exists()).toBe(true)
  })
})
