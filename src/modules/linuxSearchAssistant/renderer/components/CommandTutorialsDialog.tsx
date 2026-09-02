/**
 * Offline Linux command tutorials — opened on demand (not the primary workspace).
 */
import React, { useEffect, useState } from 'react'
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { LinuxCommandCategory, LinuxSearchHit } from '../../models'
import LinuxCommandDetail from './LinuxCommandDetail'
import LinuxSearchResultList from './LinuxSearchResultList'
import { useLinuxSearch } from '../hooks/useLinuxSearch'

const CATEGORY_OPTIONS: Array<LinuxCommandCategory | 'all'> = [
  'all',
  'files',
  'process',
  'network',
  'system',
  'text',
  'permissions',
  'package',
  'other',
]

interface CommandTutorialsDialogProps {
  open: boolean
  onClose: () => void
}

export default function CommandTutorialsDialog({
  open,
  onClose,
}: CommandTutorialsDialogProps): React.JSX.Element {
  const { searching, result, error, search } = useLinuxSearch()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<LinuxCommandCategory | 'all'>('all')
  const [selected, setSelected] = useState<LinuxSearchHit | null>(null)

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      void search({ text: query, category, limit: 40 })
    }, 180)
    return () => window.clearTimeout(handle)
  }, [open, query, category, search])

  useEffect(() => {
    if (!result?.hits.length) {
      setSelected(null)
      return
    }
    setSelected((prev) => {
      if (prev && result.hits.some((hit) => hit.entry.id === prev.entry.id)) return prev
      return result.hits[0]
    })
  }, [result])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" keepMounted={false}>
      <DialogTitle sx={{ fontWeight: 700, pr: 6 }}>
        Command tutorials
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, mt: 0.5 }}>
          Offline reference only — not used for remote search or Recent Actions.
        </Typography>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 420 }}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands (e.g. find files, disk usage)"
            fullWidth
            size="small"
            sx={{ flex: 1, minWidth: 220 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="lsa-tutorial-category-label">Category</InputLabel>
            <Select
              labelId="lsa-tutorial-category-label"
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as LinuxCommandCategory | 'all')}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ minHeight: 0, overflowY: 'auto' }}>
            {searching && !result ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <LinuxSearchResultList
                hits={result?.hits ?? []}
                selectedId={selected?.entry.id ?? null}
                onSelect={setSelected}
              />
            )}
          </Box>
          <Box sx={{ minHeight: 0, overflowY: 'auto' }}>
            <LinuxCommandDetail entry={selected?.entry ?? null} />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
