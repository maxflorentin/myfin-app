import { Timestamp } from 'firebase/firestore';

export type PaymentMethod = 'Efectivo' | 'Debito' | 'Credito' | 'Transferencia';

export interface Expense {
  id?: string;
  amount: number;
  category: string;
  description: string;
  date: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  createdByEmail: string;
  parsedFrom?: string;
  receiptUrl?: string;
  paymentMethod?: PaymentMethod;
  installments?: number;
  tags?: string[];
}

export const SUGGESTED_TAGS = [
  'Fijo',
  'Variable',
  'Excepcional',
  'Salida',
  'Refaccion',
  'Impuesto',
  'Cuota',
] as const;

export interface Income {
  id?: string;
  amount: number;
  description: string;
  date: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  createdByEmail: string;
}
