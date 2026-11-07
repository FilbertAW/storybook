import { dateLocale, useLocaleStore } from '@/i18n'

const idr = new Intl.NumberFormat('id-ID');

export const formatIdr = (amount: number) => `Rp ${idr.format(amount)}`;

// Dates follow the chosen language. Components that call these also use useT(), so they re-render on a switch.
const locale = () => dateLocale(useLocaleStore.getState().locale);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
