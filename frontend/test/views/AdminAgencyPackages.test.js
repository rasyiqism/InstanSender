import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import api from '../../src/services/api'
import AdminAgencyPackages from '../../src/views/admin/AdminAgencyPackages.vue'

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

describe('AdminAgencyPackages View (Component Test)', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  it('renders correctly when allowedPackages and features are arrays', async () => {
    api.get.mockImplementation(async (url) => {
      if (url === '/admin/agency-packages') {
        return {
          data: [
            {
              id: 'pkg-1',
              name: 'Reseller Gold',
              active: true,
              activationLimit: 20,
              allowedPackages: ['Basic', 'Premium'],
              durationDays: 365,
              price: 999000,
              features: ['Feature 1', 'Feature 2'],
            },
          ],
        }
      }
      return { data: [] }
    })

    const wrapper = mount(AdminAgencyPackages, {
      global: {
        plugins: [pinia],
      },
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(wrapper.text()).toContain('Reseller Gold')
    expect(wrapper.text()).toContain('Basic, Premium')
    expect(wrapper.text()).toContain('Feature 1')
  })

  it('renders safely when allowedPackages and features are raw strings without throwing error', async () => {
    api.get.mockImplementation(async (url) => {
      if (url === '/admin/agency-packages') {
        return {
          data: [
            {
              id: 'pkg-2',
              name: 'Reseller Silver',
              active: true,
              activationLimit: 10,
              allowedPackages: 'Basic,Premium',
              durationDays: 365,
              price: 499000,
              features: 'Feature A, Feature B',
            },
          ],
        }
      }
      return { data: [] }
    })

    const wrapper = mount(AdminAgencyPackages, {
      global: {
        plugins: [pinia],
      },
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(wrapper.text()).toContain('Reseller Silver')
    expect(wrapper.text()).toContain('Basic,Premium')
    expect(wrapper.text()).toContain('Feature A')
  })
})
