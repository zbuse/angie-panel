import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, ApiError, type HostTemplate, type HostTemplateKind } from '@/lib/api'
import { toast } from '@/lib/toast'

export function TemplatesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<HostTemplate | null>(null)
  const [deleting, setDeleting] = useState<HostTemplate | null>(null)
  const [name, setName] = useState('')
  const httpQuery = useQuery({
    queryKey: ['host-templates', 'http'],
    queryFn: () => api.listHostTemplates('http'),
  })
  const streamQuery = useQuery({
    queryKey: ['host-templates', 'stream'],
    queryFn: () => api.listHostTemplates('stream'),
  })
  const deleteMutation = useMutation({
    mutationFn: ({ kind, id }: { kind: HostTemplateKind; id: number }) =>
      api.deleteHostTemplate(kind, id),
    onSuccess: async (_result, { kind }) => {
      await queryClient.invalidateQueries({ queryKey: ['host-templates', kind] })
      setDeleting(null)
      toast({ title: t('templates.deleted') })
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: t('templates.deleteFailed'),
      description: error instanceof ApiError ? error.message : t('common.error'),
    }),
  })
  const updateMutation = useMutation({
    mutationFn: ({ template, name }: { template: HostTemplate; name: string }) =>
      api.updateHostTemplate(template.kind, template.id, { name, value: template.value }),
    onSuccess: async (_template, { template }) => {
      await queryClient.invalidateQueries({ queryKey: ['host-templates', template.kind] })
      setEditing(null)
      toast({ title: t('templates.updated') })
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: t('templates.updateFailed'),
      description: error instanceof ApiError ? error.message : t('common.error'),
    }),
  })

  const failed = httpQuery.isError || streamQuery.isError
  const pending = httpQuery.isPending || streamQuery.isPending

  const edit = (template: HostTemplate) => {
    setEditing(template)
    setName(template.name)
  }

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!editing || !trimmed || trimmed.length > 64) return
    updateMutation.mutate({ template: editing, name: trimmed })
  }

  const closeEdit = (open: boolean) => {
    if (!open && !updateMutation.isPending) setEditing(null)
  }

  const closeDelete = (open: boolean) => {
    if (!open && !deleteMutation.isPending) setDeleting(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('templates.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('templates.description')}</p>
      </div>

      {pending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('common.loading')}
        </div>
      ) : failed ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">{t('templates.pageLoadFailed')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void httpQuery.refetch()
              void streamQuery.refetch()
            }}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="http">
          <TabsList>
            <TabsTrigger value="http">{t('templates.http')} <span className="text-muted-foreground">({httpQuery.data.length})</span></TabsTrigger>
            <TabsTrigger value="stream">{t('templates.stream')} <span className="text-muted-foreground">({streamQuery.data.length})</span></TabsTrigger>
          </TabsList>
          <TabsContent value="http">
            <TemplateList
              kind="http"
              templates={httpQuery.data}
              empty={t('templates.empty')}
              editLabel={(template) => t('templates.renameNamed', { name: template.name })}
              deleteLabel={(template) => t('templates.deleteNamed', { name: template.name })}
              onEdit={edit}
              onDelete={setDeleting}
            />
          </TabsContent>
          <TabsContent value="stream">
            <TemplateList
              kind="stream"
              templates={streamQuery.data}
              empty={t('templates.empty')}
              editLabel={(template) => t('templates.renameNamed', { name: template.name })}
              deleteLabel={(template) => t('templates.deleteNamed', { name: template.name })}
              onEdit={edit}
              onDelete={setDeleting}
            />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={editing !== null} onOpenChange={closeEdit}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('templates.renameTitle')}</DialogTitle>
            <DialogDescription>{t('templates.renameDescription')}</DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={submitRename}>
            <div className="space-y-2">
              <Label htmlFor="template-rename">{t('templates.name')}</Label>
              <Input
                id="template-rename"
                autoFocus
                maxLength={64}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => closeEdit(false)} disabled={updateMutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!name.trim() || updateMutation.isPending}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={closeDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('templates.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('templates.confirmDelete', { name: deleting?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeDelete(false)} disabled={deleteMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleting || deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate({ kind: deleting.kind, id: deleting.id })}
            >
              {deleteMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('templates.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TemplateList({
  kind,
  templates,
  empty,
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: {
  kind: HostTemplateKind
  templates: HostTemplate[]
  empty: string
  editLabel: (template: HostTemplate) => string
  deleteLabel: (template: HostTemplate) => string
  onEdit: (template: HostTemplate) => void
  onDelete: (template: HostTemplate) => void
}) {
  return templates.length === 0 ? (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{empty}</CardContent>
    </Card>
  ) : (
    <Card className="p-0">
      <CardContent className="divide-y px-0 py-0">
        {templates.map((template) => (
          <div key={`${kind}-${template.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{template.name}</span>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={editLabel(template)}
                onClick={() => onEdit(template)}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={deleteLabel(template)}
                onClick={() => onDelete(template)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
