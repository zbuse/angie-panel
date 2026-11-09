import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'

import { UpstreamPoolsPage } from './upstream-pools'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => vi.unstubAllGlobals())

describe('shared upstream pools page', () => {
  it('creates a validated reusable pool', async () => {
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === '/api/upstream-pools' && options?.method === 'POST') {
        return Promise.resolve(jsonResponse({
          id: 8,
          name: 'API pool',
          scheme: 'https',
          primary_host: '10.0.0.5',
          primary_port: 8443,
          upstream: {
            servers: [], method: 'least_conn', primary_weight: 1,
            max_fails: 1, fail_timeout_secs: 10,
          },
          created_at: 1,
          updated_at: 1,
        }))
      }
      return Promise.resolve(jsonResponse({ upstream_pools: [] }))
    })
    vi.stubGlobal('fetch', fetchMock)
    render(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })}>
        <UpstreamPoolsPage />
      </QueryClientProvider>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Add pool' }))
    await userEvent.type(screen.getByLabelText('Pool name'), 'API pool')
    await userEvent.type(screen.getByLabelText('Primary server'), '10.0.0.5')
    fireEvent.change(screen.getByLabelText('Port'), { target: { value: '8443' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/upstream-pools',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"name":"API pool"'),
      }),
    )
  })
})
