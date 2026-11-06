const idr = new Intl.NumberFormat('id-ID');

export const formatIdr = (amount: number) => `Rp ${idr.format(amount)}`;

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
