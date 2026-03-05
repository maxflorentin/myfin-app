export const CATEGORIES: Record<string, string> = {
  Supermercado: '🛒',
  Alimentos: '🍕',
  Transporte: '🚗',
  Salud: '💊',
  Hogar: '🏠',
  Ropa: '👕',
  Entretenimiento: '🎬',
  Servicios: '📱',
  Educacion: '📚',
  Mascota: '🐕',
  Otro: '📦',
};

export const CATEGORY_NAMES = Object.keys(CATEGORIES);

export function categoryEmoji(cat: string): string {
  return CATEGORIES[cat] ?? '📦';
}
