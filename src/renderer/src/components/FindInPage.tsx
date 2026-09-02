import React, { useState, useEffect, useRef } from 'react'
import { Paper, InputBase, IconButton, Box, Typography, Divider } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

export default function FindInPage(): React.JSX.Element | null {
  const [isVisible, setIsVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [activeMatchOrdinal, setActiveMatchOrdinal] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const cursorRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Cmd+F or Ctrl+F
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setIsVisible(true)
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
          }
        }, 50)
      }

      // Esc to close
      if (e.key === 'Escape' && isVisible) {
        closeFind()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) return
    const unsubscribe = window.api.onFoundInPage((result: any) => {
      if (result.matches !== undefined) {
        setMatchCount(result.matches)
      }
      if (result.activeMatchOrdinal !== undefined) {
        setActiveMatchOrdinal(result.activeMatchOrdinal)
      }
      
      if (inputRef.current && document.activeElement === inputRef.current) {
        if (cursorRef.current.start !== null && cursorRef.current.end !== null) {
          inputRef.current.setSelectionRange(cursorRef.current.start, cursorRef.current.end)
        }
      }
    })
    return unsubscribe
  }, [isVisible])

  useEffect(() => {
    if (isVisible && searchText) {
      if (inputRef.current) {
        cursorRef.current = {
          start: inputRef.current.selectionStart,
          end: inputRef.current.selectionEnd
        }
      }
      void window.api.findInPage(searchText)
    } else if (isVisible && !searchText) {
      setMatchCount(0)
      setActiveMatchOrdinal(0)
      void window.api.stopFindInPage('clearSelection')
    }
  }, [searchText, isVisible])

  const findNext = (forward = true): void => {
    if (searchText) {
      void window.api.findInPage(searchText, { forward, findNext: true })
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      findNext(!e.shiftKey)
    }
  }

  const closeFind = (): void => {
    setIsVisible(false)
    setSearchText('')
    void window.api.stopFindInPage('clearSelection')
  }

  if (!isVisible) return null

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        padding: '2px 4px',
        width: 320,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <SearchIcon sx={{ color: 'action.active', ml: 1, mr: 1, fontSize: 20 }} />
      <InputBase
        inputRef={inputRef}
        sx={{ ml: 1, flex: 1, fontSize: '0.875rem' }}
        placeholder="Find in page..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        onKeyDown={handleInputKeyDown}
      />
      {searchText && (
        <Typography variant="caption" color="text.secondary" sx={{ mx: 1, minWidth: 35, textAlign: 'center' }}>
          {matchCount > 0 ? `${activeMatchOrdinal}/${matchCount}` : '0/0'}
        </Typography>
      )}
      <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
      <Box sx={{ display: 'flex' }}>
        <IconButton size="small" onClick={() => findNext(false)} disabled={!searchText || matchCount === 0}>
          <KeyboardArrowUpIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => findNext(true)} disabled={!searchText || matchCount === 0}>
          <KeyboardArrowDownIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
      <IconButton size="small" onClick={closeFind}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  )
}
