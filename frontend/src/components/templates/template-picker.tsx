import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [dialogMode, setDialogMode] = useState<'save' | 'update' | null>(null)
  const [templateName, setTemplateName] = useState('')
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
      setDialogMode(null)
      toast({ title: t('templates.saved') })
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: t('templates.saveFailed'),
      description: error instanceof ApiError ? error.message : t('common.error'),
    }),
  })
  const updateMutation = useMutation({
    mutationFn: (input: { id: number; name: string; value: Record<string, unknown> }) =>
      api.updateHostTemplate(kind, input.id, { name: input.name, value: input.value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['host-templates', kind] })
      setDialogMode(null)
      toast({ title: t('templates.updated') })
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

  const openSaveDialog = () => {
    setTemplateName('')
    setDialogMode('save')
  }

  const openUpdateDialog = () => {
    if (!selected.startsWith('custom:')) return
    const id = Number(selected.slice('custom:'.length))
    const template = custom.find((entry) => entry.id === id)
    if (!template) return
    setTemplateName(template.name)
    setDialogMode('update')
  }

  const submitTemplate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = templateName.trim()
    if (!name) return
    if (name.length > 64) {
      toast({ variant: 'destructive', title: t('templates.nameTooLong') })
      return
    }
    if (new TextEncoder().encode(JSON.stringify(value)).length > 16 * 1024) {
      toast({ variant: 'destructive', title: t('templates.valueTooLarge') })
      return
    }
    if (dialogMode === 'save') {
      saveMutation.mutate({ name, value })
      return
    }
    if (dialogMode === 'update' && selected.startsWith('custom:')) {
      const id = Number(selected.slice('custom:'.length))
      if (Number.isSafeInteger(id) && id > 0) {
        updateMutation.mutate({ id, name, value })
      }
    }
  }

  return (
    <>
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end">
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
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={openSaveDialog} disabled={saveMutation.isPending || updateMutation.isPending}>
          {t('templates.save')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selected.startsWith('custom:') || updateMutation.isPending}
          onClick={openUpdateDialog}
        >
          {t('templates.update')}
        </Button>
      </div>
    </div>
    <Dialog open={dialogMode !== null} onOpenChange={(open) => {
      if (!open && !saveMutation.isPending && !updateMutation.isPending) setDialogMode(null)
    }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t(dialogMode === 'update' ? 'templates.updateTitle' : 'templates.saveTitle')}</DialogTitle>
          <DialogDescription>
            {t(dialogMode === 'update' ? 'templates.updateDescription' : 'templates.saveDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submitTemplate}>
          <div className="space-y-2">
            <Label htmlFor={`template-name-${kind}`}>{t('templates.name')}</Label>
            <Input
              id={`template-name-${kind}`}
              autoFocus
              maxLength={64}
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!templateName.trim() || saveMutation.isPending || updateMutation.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
