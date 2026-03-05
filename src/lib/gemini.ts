import { CATEGORY_NAMES } from './categories';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface ParsedExpense {
  amount: number;
  category: string;
  description: string;
}

const KEYWORD_MAP: Record<string, string> = {
  super: 'Supermercado',
  supermercado: 'Supermercado',
  mercado: 'Supermercado',
  chino: 'Supermercado',
  carrefour: 'Supermercado',
  dia: 'Supermercado',
  coto: 'Supermercado',
  jumbo: 'Supermercado',
  vea: 'Supermercado',
  comida: 'Alimentos',
  almuerzo: 'Alimentos',
  cena: 'Alimentos',
  pizza: 'Alimentos',
  cafe: 'Alimentos',
  helado: 'Alimentos',
  restaurante: 'Alimentos',
  delivery: 'Alimentos',
  rappi: 'Alimentos',
  pedidos: 'Alimentos',
  panaderia: 'Alimentos',
  verduleria: 'Alimentos',
  carniceria: 'Alimentos',
  nafta: 'Transporte',
  uber: 'Transporte',
  taxi: 'Transporte',
  sube: 'Transporte',
  colectivo: 'Transporte',
  subte: 'Transporte',
  estacionamiento: 'Transporte',
  farmacia: 'Salud',
  medico: 'Salud',
  doctor: 'Salud',
  obra: 'Salud',
  prepaga: 'Salud',
  luz: 'Servicios',
  gas: 'Servicios',
  agua: 'Servicios',
  internet: 'Servicios',
  telefono: 'Servicios',
  celular: 'Servicios',
  netflix: 'Entretenimiento',
  spotify: 'Entretenimiento',
  cine: 'Entretenimiento',
  salida: 'Entretenimiento',
  veterinaria: 'Mascota',
  mascota: 'Mascota',
  perro: 'Mascota',
  gato: 'Mascota',
  ropa: 'Ropa',
  zapatillas: 'Ropa',
  escuela: 'Educacion',
  curso: 'Educacion',
  libro: 'Educacion',
  alquiler: 'Hogar',
  expensas: 'Hogar',
  limpieza: 'Hogar',
  ferreteria: 'Hogar',
};

function parseAmountFromText(text: string): number {
  const match = text.match(/(\d+[\.,]?\d*)\s*k\b/i);
  if (match) return parseFloat(match[1].replace(',', '.')) * 1000;

  const match2 = text.match(/(\d{1,3}(?:[\.,]\d{3})+)/);
  if (match2) return parseFloat(match2[1].replace(/\./g, '').replace(',', '.'));

  const match3 = text.match(/(\d+)/);
  if (match3) return parseInt(match3[1], 10);

  return 0;
}

function localParse(input: string): ParsedExpense | null {
  const lower = input.toLowerCase().trim();
  const amount = parseAmountFromText(lower);
  if (amount <= 0) return null;

  let category = 'Otro';
  let description = lower.replace(/\d+[\.,]?\d*\s*k?\b/gi, '').trim();

  for (const [keyword, cat] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(keyword)) {
      category = cat;
      if (!description || description === keyword) {
        description = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      }
      break;
    }
  }

  if (!description) description = category;

  return { amount, category, description };
}

function validateParsed(data: ParsedExpense): ParsedExpense | null {
  if (!data.amount || data.amount <= 0) return null;
  if (!CATEGORY_NAMES.includes(data.category)) data.category = 'Otro';
  data.description = (data.description || '').slice(0, 200);
  if (!data.description) data.description = data.category;
  return data;
}

export async function parseExpenseInput(input: string): Promise<ParsedExpense | null> {
  if (!API_KEY) return localParse(input);

  try {
    const prompt = `Sos un parser de gastos argentinos. Dada la entrada del usuario, extraé el monto en pesos argentinos y la categoría.
Categorías válidas: ${CATEGORY_NAMES.join(', ')}.
Respondé SOLO con JSON: {"amount": number, "category": "string", "description": "string"}
Si dice "k" después de un número, multiplicá por 1000 (ej: "10k" = 10000).
Entrada: "${input}"`;

    const res = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
      }),
    });

    if (!res.ok) throw new Error(`Gemini ${res.status}`);

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed: ParsedExpense = JSON.parse(jsonMatch[0]);
    return validateParsed(parsed);
  } catch {
    return localParse(input);
  }
}

export async function getFinancialTip(
  categoryBreakdown: string,
  tagBreakdown: string,
  totalExpenses: number,
  totalIncome: number,
): Promise<string> {
  if (!API_KEY) return '';

  try {
    const balance = totalIncome - totalExpenses;
    const prompt = `Sos un asesor financiero personal argentino. Basado en los gastos del mes, da UN consejo breve y práctico (máximo 2 oraciones).

Gastos totales: $${totalExpenses.toLocaleString('es-AR')}
Ingresos totales: $${totalIncome.toLocaleString('es-AR')}
Balance: $${balance.toLocaleString('es-AR')}

Desglose por categoría:
${categoryBreakdown}

Desglose por tipo de gasto:
${tagBreakdown}

Respondé solo con el consejo, sin formato markdown ni bullets.`;

    const res = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
      }),
    });

    if (!res.ok) return '';

    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  } catch {
    return '';
  }
}
