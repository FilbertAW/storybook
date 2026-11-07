import { useCallback } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { en, type TranslationKey } from './en'
import { id } from './id'

export type Locale = 'id' | 'en'
export type { TranslationKey }

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, id }

// Client state only: the chosen language. Indonesian is the default.
interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'id',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'storylib-locale' },
  ),
)

export type Params = Record<string, string | number>

const fill = (text: string, params?: Params) =>
  params ? text.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match)) : text

// For code that is not a component (API errors, date formats); reads the current language.
export const translate = (key: TranslationKey, params?: Params, locale = useLocaleStore.getState().locale) =>
  fill(dictionaries[locale][key], params)

export const hasKey = (key: string): key is TranslationKey => key in en

// Components re-render when the language changes because they subscribe to it here.
export function useT() {
  const locale = useLocaleStore((s) => s.locale)
  const t = useCallback((key: TranslationKey, params?: Params) => translate(key, params, locale), [locale])
  return { t, locale }
}

// Singular and plural keys end in .one and .other.
export const plural = (base: string, count: number) => `${base}.${count === 1 ? 'one' : 'other'}` as TranslationKey

export const dateLocale = (locale: Locale) => (locale === 'id' ? 'id-ID' : 'en-GB')
