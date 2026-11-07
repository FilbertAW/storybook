import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { type Locale, useLocaleStore, useT } from '@/i18n'

const LOCALES: Array<{ value: Locale; label: string }> = [
  { value: 'id', label: 'ID' },
  { value: 'en', label: 'EN' },
]

// Keeps <html lang> in step with the language; mounted once at the root.
export function LocaleEffect() {
  const locale = useLocaleStore((s) => s.locale)
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return null
}

export function LanguageSwitch() {
  const { t, locale } = useT()
  const setLocale = useLocaleStore((s) => s.setLocale)
  return (
    <div role="group" aria-label={t('lang.label')} className="flex items-center rounded-lg border p-0.5">
      {LOCALES.map((l) => (
        <Button
          key={l.value}
          type="button"
          variant={locale === l.value ? 'secondary' : 'ghost'}
          size="xs"
          aria-pressed={locale === l.value}
          onClick={() => setLocale(l.value)}
        >
          {l.label}
        </Button>
      ))}
    </div>
  )
}
