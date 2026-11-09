import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, ApiError, type BalanceMethod, type UpstreamPool, type UpstreamPoolInput, type UpstreamServer } from '@/lib/api'
import { toast } from '@/lib/toast'

interface PoolDraft {
  name: string
  scheme: 'http' | 'https'
  primary_host: string
  primary_port: string
  method: BalanceMethod
  primary_weight: string
  max_fails: string
  fail_timeout_secs: string
  servers: (Omit<UpstreamServer, 'port' | 'weight'> & { port: string; weight: string })[]
}

function draftFrom(pool: UpstreamPool | null): PoolDraft {
  return {
    name: pool?.name ?? '',
    scheme: pool?.scheme ?? 'http',
    primary_host: pool?.primary_host ?? '',
    primary_port: String(pool?.primary_port ?? 80),
    method: pool?.upstream.method ?? 'round_robin',
    primary_weight: String(pool?.upstream.primary_weight ?? 1),
    max_fails: String(pool?.upstream.max_fails ?? 1),
    fail_timeout_secs: String(pool?.upstream.fail_timeout_secs ?? 10),
    servers: (pool?.upstream.servers ?? []).map((server) => ({
      ...server,
      port: String(server.port),
      weight: String(server.weight),
    })),
  }
}

function toInput(draft: PoolDraft): UpstreamPoolInput {
  return {
    name: draft.name,
    scheme: draft.scheme,
    primary_host: draft.primary_host,
    primary_port: Number.parseInt(draft.primary_port, 10) || 0,
    upstream: {
      method: draft.method,
      primary_weight: Number.parseInt(draft.primary_weight, 10) || 1,
      max_fails: Number.parseInt(draft.max_fails, 10) || 0,
      fail_timeout_secs: Number.parseInt(draft.fail_timeout_secs, 10) || 0,
      servers: draft.servers.map((server) => ({
        host: server.host,
        port: Number.parseInt(server.port, 10) || 0,
        weight: Number.parseInt(server.weight, 10) || 1,
        backup: server.backup,
        down: server.down,
      })),
    },
  }
}

export function UpstreamPoolsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<UpstreamPool | null>(null)
  const [open, setOpen] = useState(false)
  const poolsQuery = useQuery({ queryKey: ['upstream-pools'], queryFn: api.listUpstreamPools })
  const deleteMutation = useMutation({
    mutationFn: api.deleteUpstreamPool,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['upstream-pools'] })
      toast({ title: t('upstreams.deleted') })
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: t('upstreams.actionFailed'),
      description: error instanceof ApiError ? error.message : t('common.error'),
    }),
  })

  const startCreate = () => {
    setEditing(null)
    setOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('upstreams.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('upstreams.description')}</p>
        </div>
        <Button onClick={startCreate}><Plus aria-hidden="true" />{t('upstreams.add')}</Button>
      </div>
      {poolsQuery.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t('common.loading')}</div>
      ) : poolsQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">{t('upstreams.loadFailed')}</p>
      ) : poolsQuery.data.upstream_pools.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t('upstreams.empty')}</CardContent></Card>
      ) : (
        <Card className="p-0"><CardContent className="px-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t('upstreams.name')}</TableHead>
              <TableHead>{t('upstreams.primary')}</TableHead>
              <TableHead>{t('upstreams.peers')}</TableHead>
              <TableHead className="w-0 text-right">{t('upstreams.actions')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>{poolsQuery.data.upstream_pools.map((pool) => (
              <TableRow key={pool.id}>
                <TableCell className="font-medium">{pool.name}</TableCell>
                <TableCell className="font-mono text-xs">{pool.scheme}://{pool.primary_host}:{pool.primary_port}</TableCell>
                <TableCell className="text-muted-foreground">{pool.upstream.servers.length + 1}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(pool); setOpen(true) }}>{t('upstreams.edit')}</Button>
                    <Button size="icon-sm" variant="ghost" aria-label={t('upstreams.delete', { name: pool.name })} disabled={deleteMutation.isPending} onClick={() => {
                      if (window.confirm(t('upstreams.confirmDelete', { name: pool.name }))) deleteMutation.mutate(pool.id)
                    }}><Trash2 aria-hidden="true" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </CardContent></Card>
      )}
      {open && <PoolEditor
        key={editing?.id ?? 'new'}
        pool={editing}
        onOpenChange={setOpen}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['upstream-pools'] })
          setOpen(false)
        }}
      />}
    </div>
  )
}

function PoolEditor({
  pool, onOpenChange, onSaved,
}: {
  pool: UpstreamPool | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(() => draftFrom(pool))
  const queryClient = useQueryClient()
  const saveMutation = useMutation({
    mutationFn: (input: UpstreamPoolInput) => pool
      ? api.updateUpstreamPool(pool.id, input)
      : api.createUpstreamPool(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['upstream-pools'] })
      onSaved()
      toast({ title: t(pool ? 'upstreams.updated' : 'upstreams.created') })
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: t('upstreams.actionFailed'),
      description: error instanceof ApiError ? error.message : t('common.error'),
    }),
  })
  const patch = (change: Partial<PoolDraft>) => setDraft((current) => ({ ...current, ...change }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    saveMutation.mutate(toInput(draft))
  }
  const addServer = () => patch({ servers: [...draft.servers, { host: '', port: '80', weight: '1', backup: false, down: false }] })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(pool ? 'upstreams.edit' : 'upstreams.add')}</DialogTitle>
          <DialogDescription>{t('upstreams.editorHint')}</DialogDescription>
        </DialogHeader>
        <form id="pool-editor-form" className="max-h-[70vh] space-y-4 overflow-y-auto px-1" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="pool-name">{t('upstreams.name')}</Label><Input id="pool-name" required maxLength={64} value={draft.name} onChange={(e) => patch({ name: e.target.value })} /></div>
            <div className="space-y-2"><Label>{t('upstreams.scheme')}</Label>
              <Select value={draft.scheme} onValueChange={(scheme) => patch({ scheme: scheme as PoolDraft['scheme'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="http">HTTP</SelectItem><SelectItem value="https">HTTPS</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="pool-primary">{t('upstreams.primary')}</Label><Input id="pool-primary" required value={draft.primary_host} onChange={(e) => patch({ primary_host: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="pool-port">{t('upstreams.port')}</Label><Input id="pool-port" required inputMode="numeric" value={draft.primary_port} onChange={(e) => patch({ primary_port: e.target.value.replace(/[^0-9]/g, '') })} /></div>
            <div className="space-y-2"><Label>{t('upstreams.method')}</Label>
              <Select value={draft.method} onValueChange={(method) => patch({ method: method as BalanceMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="round_robin">round_robin</SelectItem><SelectItem value="least_conn">least_conn</SelectItem><SelectItem value="ip_hash">ip_hash</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2"><Label htmlFor="pool-weight">{t('upstreams.weight')}</Label><Input id="pool-weight" inputMode="numeric" value={draft.primary_weight} onChange={(e) => patch({ primary_weight: e.target.value.replace(/[^0-9]/g, '') })} /></div>
              <div className="space-y-2"><Label htmlFor="pool-fails">{t('upstreams.maxFails')}</Label><Input id="pool-fails" inputMode="numeric" value={draft.max_fails} onChange={(e) => patch({ max_fails: e.target.value.replace(/[^0-9]/g, '') })} /></div>
              <div className="space-y-2"><Label htmlFor="pool-timeout">{t('upstreams.timeout')}</Label><Input id="pool-timeout" inputMode="numeric" value={draft.fail_timeout_secs} onChange={(e) => patch({ fail_timeout_secs: e.target.value.replace(/[^0-9]/g, '') })} /></div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><Label>{t('upstreams.peers')}</Label><Button type="button" size="sm" variant="outline" onClick={addServer}><Plus aria-hidden="true" />{t('upstreams.addPeer')}</Button></div>
            {draft.servers.map((server, index) => (
              <div key={index} className="grid gap-2 border-t pt-3 sm:grid-cols-[1fr_6rem_6rem_auto]">
                <Input aria-label={t('upstreams.peerHost')} value={server.host} onChange={(e) => patch({ servers: draft.servers.map((item, i) => i === index ? { ...item, host: e.target.value } : item) })} />
                <Input aria-label={t('upstreams.port')} inputMode="numeric" value={server.port} onChange={(e) => patch({ servers: draft.servers.map((item, i) => i === index ? { ...item, port: e.target.value.replace(/[^0-9]/g, '') } : item) })} />
                <Input aria-label={t('upstreams.weight')} inputMode="numeric" value={server.weight} onChange={(e) => patch({ servers: draft.servers.map((item, i) => i === index ? { ...item, weight: e.target.value.replace(/[^0-9]/g, '') } : item) })} />
                <Button type="button" size="sm" variant="ghost" onClick={() => patch({ servers: draft.servers.filter((_, i) => i !== index) })}>{t('upstreams.removePeer')}</Button>
              </div>
            ))}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>{t('common.cancel')}</Button>
          <Button type="submit" form="pool-editor-form" disabled={saveMutation.isPending}>{saveMutation.isPending && <Loader2 className="animate-spin" />}{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
