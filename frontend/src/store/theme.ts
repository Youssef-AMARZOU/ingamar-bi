import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  darkMode: boolean
  toggleDarkMode: () => void
}

const getInitialDarkMode = (): boolean => {
  try {
    const stored = localStorage.getItem('ingamar-theme')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed?.state?.darkMode !== undefined) {
        return parsed.state.darkMode
      }
    }
  } catch {}
  return false
}

const applyTheme = (dark: boolean) => {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

const initialDarkMode = getInitialDarkMode()
applyTheme(initialDarkMode)

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      darkMode: initialDarkMode,
      toggleDarkMode: () => set((state) => {
        const next = !state.darkMode
        applyTheme(next)
        return { darkMode: next }
      }),
    }),
    { name: 'ingamar-theme' }
  )
)
