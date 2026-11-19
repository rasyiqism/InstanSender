import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import api from '../../src/services/api'
import Devices from '../../src/views/dashboard/Devices.vue'
import { useDeviceStore } from '../../src/stores/device'

vi.mock('../../src/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

describe('Devices View & Store (Regression Test)', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  it('renders device list without throwing TypeError when devices are loaded', async () => {
    api.get.mockResolvedValueOnce({
      data: [
        {
          id: 'dev-001',
          name: 'Main WhatsApp',
          phoneNumber: '628123456789',
          status: 'connected',
        },
      ],
    })

    const wrapper = mount(Devices, {
      global: {
        plugins: [pinia],
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Devices')
    expect(wrapper.text()).toContain('Main WhatsApp')
    expect(wrapper.text()).toContain('628123456789')
  })

  it('safely handles create device and does not insert undefined into store', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    const store = useDeviceStore()

    // Backend returns { ...device, qr } (and device property)
    api.post.mockResolvedValueOnce({
      data: {
        id: 'dev-999',
        name: 'New CS Phone',
        status: 'pending_qr',
        qr: 'data:image/png;base64,mockqr',
      },
    })

    const created = await store.create('New CS Phone')
    expect(created.id).toBe('dev-999')
    expect(store.devices.length).toBe(1)
    expect(store.devices[0]).toBeDefined()
    expect(store.devices[0].id).toBe('dev-999')
    expect(store.devices[0].name).toBe('New CS Phone')
  })

  it('renders safely even if store directly contains malformed or undefined device entries', async () => {
    api.get.mockResolvedValueOnce({ data: [] })

    const wrapper = mount(Devices, {
      global: {
        plugins: [pinia],
      },
    })

    await flushPromises()

    const store = useDeviceStore()
    // Directly inject undefined/null into store to simulate edge case
    store.devices = [undefined, null, { id: 'dev-valid', name: 'Valid Device', status: 'connected' }]

    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Valid Device')
    expect(wrapper.find('.text-slate-900').exists()).toBe(true)
  })
})

