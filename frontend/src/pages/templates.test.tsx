import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'

import { TemplatesPage } from './templates'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('templates page', () => {
  it('lists personal templates and confirms before deleting one', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/host-templates/http' && init?.method === 'GET') {
        return Promise.resolve(jsonResponse([
          {
            id: 1,
            kind: 'http',
            name: 'Production proxy',
            value: { websockets_upgrade: true },
            created_at: 1,
            updated_at: 1,
          },
        ]))
      }
      if (url === '/api/host-templates/stream' && init?.method === 'GET') {
        return Promise.resolve(jsonResponse([]))
      }
      if (url === '/api/host-templates/http/1' && init?.method === 'DELETE') {
        return Promise.resolve(jsonResponse({ ok: true }))
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })}>
        <TemplatesPage />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Production proxy')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Production proxy' }))
    expect(await screen.findByRole('heading', { name: 'Delete template?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete template' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/host-templates/http/1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
