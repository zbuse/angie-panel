import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export type BulkAction = 'enable' | 'disable' | 'delete'

export function BulkActionBar({
  selectedCount,
  totalCount,
  allSelected,
  disabled = false,
  onSelectAll,
  onAction,
}: {
  selectedCount: number
  totalCount: number
  allSelected: boolean
  disabled?: boolean
  onSelectAll: (selected: boolean) => void
  onAction: (action: BulkAction) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          aria-label={t('common.bulk.selectAll')}
          checked={allSelected}
          onChange={(event) => onSelectAll(event.target.checked)}
          disabled={disabled}
        />
        {t('common.bulk.selected', { count: selectedCount, total: totalCount })}
      </label>
      <Button size="sm" variant="outline" disabled={disabled || selectedCount === 0} onClick={() => onAction('enable')}>
        {t('common.bulk.enable')}
      </Button>
      <Button size="sm" variant="outline" disabled={disabled || selectedCount === 0} onClick={() => onAction('disable')}>
        {t('common.bulk.disable')}
      </Button>
      <Button size="sm" variant="destructive" disabled={disabled || selectedCount === 0} onClick={() => onAction('delete')}>
        {t('common.bulk.delete')}
      </Button>
    </div>
  )
}
