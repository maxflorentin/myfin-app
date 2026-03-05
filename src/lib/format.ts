import { Timestamp } from 'firebase/firestore';

const currencyFmt = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
});

const fullDateFmt = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatCurrency(n: number): string {
  return currencyFmt.format(n);
}

export function formatDate(ts: Timestamp): string {
  return dateFmt.format(ts.toDate());
}

export function formatFullDate(ts: Timestamp): string {
  return fullDateFmt.format(ts.toDate());
}

export function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}
