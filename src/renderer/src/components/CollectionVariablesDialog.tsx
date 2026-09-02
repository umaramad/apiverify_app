import React, { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Input,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type { CollectionVariable } from '../../../shared/collectionVariables'

interface CollectionVariablesDialogProps {
  open: boolean
  variables: CollectionVariable[]
  onClose: () => void
  onSave: (variables: CollectionVariable[]) => Promise<{ success: boolean; error?: string }>
}

const EMPTY_VARIABLE: CollectionVariable = {
  key: '',
  value: '',
  description: '',
  enabled: true,
}

export default function CollectionVariablesDialog({
  open,
  variables,
  onClose,
  onSave,
}: CollectionVariablesDialogProps): React.JSX.Element {
  const [rows, setRows] = useState<CollectionVariable[]>(variables)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setRows(variables.length > 0 ? variables.map((variable) => ({ ...variable })) : [{ ...EMPTY_VARIABLE }])
      setError(null)
    }
  }, [open, variables])

  const updateRow = (index: number, fields: Partial<CollectionVariable>): void => {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...fields } : row)))
  }

  const handleSave = async (): Promise<void> => {
    const cleaned = rows
      .map((row) => ({
        key: row.key.trim(),
        value: row.value,
        description: row.description?.trim() || undefined,
        enabled: row.enabled !== false,
      }))
      .filter((row) => row.key)

    const duplicate = cleaned.find((row, index) => cleaned.findIndex((item) => item.key === row.key) !== index)
    if (duplicate) {
      setError(`Duplicate variable key: ${duplicate.key}`)
      return
    }

    setSaving(true)
    setError(null)
    const result = await onSave(cleaned)
    setSaving(false)

    if (result.success) {
      onClose()
    } else {
      setError(result.error ?? 'Failed to save collection variables.')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Collection Pre-Variables</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Pre-variables are available to every request in this collection using {'{{variableName}}'} in URL,
          headers, query params, path variables, and body. Environment variables are applied first; collection
          pre-variables override on matching keys. Post-variables from earlier requests override both during a
          collection run.
        </Typography>

        {error && (
          <Typography variant="body2" color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ width: 50 }} />
                <TableCell>Key</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Description</TableCell>
                <TableCell sx={{ width: 50 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={row.enabled !== false}
                      onChange={(event) => updateRow(index, { enabled: event.target.checked })}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.key}
                      onChange={(event) => updateRow(index, { key: event.target.value })}
                      placeholder="userId"
                      fullWidth
                      disableUnderline
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.value}
                      onChange={(event) => updateRow(index, { value: event.target.value })}
                      placeholder="{{baseUrl}} or literal"
                      fullWidth
                      disableUnderline
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.description || ''}
                      onChange={(event) => updateRow(index, { description: event.target.value })}
                      placeholder="Optional"
                      fullWidth
                      disableUnderline
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Button
          startIcon={<AddIcon />}
          size="small"
          onClick={() => setRows((prev) => [...prev, { ...EMPTY_VARIABLE }])}
          sx={{ mt: 1.5 }}
        >
          Add Variable
        </Button>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Variables'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
