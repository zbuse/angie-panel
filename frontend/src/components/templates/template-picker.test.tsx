import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'

import { TemplatePicker } from './template-picker'

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('host template picker', () => {
  it('applies built-in and personal templates, saves them in a dialog, and updates them', async () => {
    const onApply = vi.fn()
    const stored: Array<{ id: number; kind: string; name: string; value: Record<string, unknown>; created_at: number; updated_at: number }> = []
    let id = 1
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === '/api/host-templates/http' && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify(stored), { status: 200 })
      }
      if (input === '/api/host-templates/http' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { name: string; value: Record<string, unknown> }
        const template = { id: id++, kind: 'http', ...body, created_at: 1, updated_at: 1 }
        stored.push(template)
        return new Response(JSON.stringify(template), { status: 200 })
      }
      if (input === '/api/host-templates/http/1' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { name: string; value: Record<string, unknown> }
        stored[0] = { ...stored[0], ...body, updated_at: 2 }
        return new Response(JSON.stringify(stored[0]), { status: 200 })
      }
      return Promise.reject(new Error(`unexpected fetch ${input}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <TemplatePicker
          kind="http"
          builtIns={[{ id: 'ws', name: 'HTTP · WebSocket service', value: { websockets_upgrade: true } }]}
          value={{ websockets_upgrade: true, domains: [] }}
          onApply={onApply}
        />
      </QueryClientProvider>,
    )

    await userEvent.click(screen.getByRole('combobox', { name: 'Host template' }))
    await userEvent.click(screen.getByRole('option', { name: 'HTTP · WebSocket service' }))
    expect(onApply).toHaveBeenLastCalledWith({ websockets_upgrade: true })

    await userEvent.click(screen.getByRole('button', { name: 'Save as template' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Template name' }), 'My HTTP setup')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(stored).toHaveLength(1))
    expect(stored).toEqual([expect.objectContaining({
      id: 1,
      name: 'My HTTP setup',
      value: { websockets_upgrade: true, domains: [] },
      kind: 'http',
    })])

    await userEvent.click(screen.getByRole('combobox', { name: 'Host template' }))
    await userEvent.click(screen.getByRole('option', { name: 'HTTP · WebSocket service' }))
    await userEvent.click(screen.getByRole('combobox', { name: 'Host template' }))
    await userEvent.click(screen.getByRole('option', { name: 'My HTTP setup' }))
    expect(onApply).toHaveBeenLastCalledWith({ websockets_upgrade: true, domains: [] })
    await userEvent.click(screen.getByRole('button', { name: 'Update from current settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/host-templates/http/1',
      expect.objectContaining({ method: 'PUT' }),
    ))
  }, 10_000)
})
