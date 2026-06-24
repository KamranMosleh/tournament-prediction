'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const DARK_THEME_COLOR = '#0d1117'
const LIGHT_THEME_COLOR = '#f6f8fa'

function storedTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : null
}

function setThemeColor(theme: Theme) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = theme === 'light' ? LIGHT_THEME_COLOR : DARK_THEME_COLOR
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  setThemeColor(theme)
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = storedTheme()
    const initialTheme = saved ?? 'dark'
    setTheme(initialTheme)
    applyTheme(initialTheme)
  }, [])

  const nextTheme = theme === 'light' ? 'dark' : 'light'
  const label = `Switch to ${nextTheme} mode`

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={theme === 'light'}
      onClick={() => {
        window.localStorage.setItem(STORAGE_KEY, nextTheme)
        setTheme(nextTheme)
        applyTheme(nextTheme)
      }}
      className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        color: 'var(--text-muted)',
      }}
    >
      {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  )
}
