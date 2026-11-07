import { Link } from 'react-router'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { useT } from '@/i18n'

export function NotFound() {
  const { t } = useT()
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <h1 className="text-xl font-semibold">{t('notfound.title')}</h1>
      <Link to="/" className="text-sm underline">
        {t('notfound.back')}
      </Link>
      <LanguageSwitch />
    </div>
  )
}
