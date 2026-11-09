import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, ApiError, type HostTemplateKind } from '@/lib/api'
import { toast } from '@/lib/toast'

export interface BuiltInTemplate {
  id: string
  name: string
  value: Record<string, unknown>
}

export function TemplatePicker({
  kind,
  builtIns,
  value,
  onApply,
}: {
  kind: HostTemplateKind
  builtIns: BuiltInTemplate[]
  value: Record<string, unknown>
  onApply: (value: Record<string, unknown>) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState('')
  const templatesQuery = useQuery({
    queryKey: ['host-templates', kind],
    queryFn: () => api.listHostTemplates(kind),
  })
  const custom = templatesQuery.data ?? []

  const saveMutation = useMutation({
    mutationFn: (input: { name: string; value: Record<string, unknown> }) =>
      api.createHostTemplate(kind, input),
    onSuccess: async (template) => {
      setSelected(`custom:${template.id}`)
      await queryClient.invalidateQueries({ queryKey: ['host-templates', kind] })
      toast({ title: t('templates.savedShared') })
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: t('templates.saveFailed'),
      description: error instanceof ApiError ? error.message : t('common.error'),
    }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteHostTemplate(kind, id),
    onSuccess: async () => {
      setSelected('')
      await queryClient.invalidateQueries({ queryKey: ['host-templates', kind] })
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: t('templates.deleteFailed'),
      description: error instanceof ApiError ? error.message : t('common.error'),
    }),
  })
  const updateMutation = useMutation({
    mutationFn: (input: { id: number; name: string; value: Record<string, unknown> }) =>
      api.updateHostTemplate(kind, input.id, { name: input.name, value: input.value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['host-templates', kind] })
      toast({ title: t('templates.updatedShared') })
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: t('templates.updateFailed'),
      description: error instanceof ApiError ? error.message : t('common.error'),
    }),
  })

  const entries = [
    ...builtIns.map((entry) => ({ ...entry, key: entry.id })),
    ...custom.map((entry) => ({ ...entry, key: `custom:${entry.id}` })),
  ]

  const choose = (key: string) => {
    setSelected(key)
    const entry = entries.find((item) => item.key === key)
    if (entry) onApply(entry.value)
  }

  const save = () => {
    const name = window.prompt(t('templates.namePrompt'))?.trim()
    if (!name) return
    if (name.length > 64) {
      toast({ variant: 'destructive', title: t('templates.nameTooLong') })
      return
    }
    if (new TextEncoder().encode(JSON.stringify(value)).length > 16 * 1024) {
      toast({ variant: 'destructive', title: t('templates.valueTooLarge') })
      return
    }
    saveMutation.mutate({ name, value })
  }

  const remove = () => {
    if (!selected.startsWith('custom:')) return
    const id = Number(selected.slice('custom:'.length))
    if (Number.isSafeInteger(id) && id > 0) deleteMutation.mutate(id)
  }

  const updateSelected = () => {
    if (!selected.startsWith('custom:')) return
    const id = Number(selected.slice('custom:'.length))
    const template = custom.find((entry) => entry.id === id)
    if (!template) return
    if (new TextEncoder().encode(JSON.stringify(value)).length > 16 * 1024) {
      toast({ variant: 'destructive', title: t('templates.valueTooLarge') })
      return
    }
    updateMutation.mutate({ id, name: template.name, value })
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
      <div className="min-w-52 flex-1 space-y-2">
        <label className="text-sm font-medium">{t('templates.pick')}</label>
        <Select value={selected} onValueChange={choose}>
          <SelectTrigger aria-label={t('templates.pick')}><SelectValue placeholder={t('templates.choose')} /></SelectTrigger>
          <SelectContent>
            {builtIns.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}
            {custom.length > 0 && <SelectItem value="custom-heading" disabled>{t('templates.custom')}</SelectItem>}
            {custom.map((entry) => <SelectItem key={entry.id} value={`custom:${entry.id}`}>{entry.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {templatesQuery.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t('templates.loadFailed')}: {templatesQuery.error instanceof ApiError
              ? templatesQuery.error.message
              : t('common.error')}
          </p>
        )}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={save} disabled={saveMutation.isPending || updateMutation.isPending}>
        {t('templates.save')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!selected.startsWith('custom:') || updateMutation.isPending}
        onClick={updateSelected}
      >
        {t('templates.update')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!selected.startsWith('custom:') || deleteMutation.isPending || updateMutation.isPending}
        onClick={remove}
      >
        {t('templates.delete')}
      </Button>
    </div>
  )
}
