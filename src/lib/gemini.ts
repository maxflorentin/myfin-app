import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { app } from './firebase';
import { CATEGORY_NAMES } from './categories';

const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' });

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

export async function parseExpenseInput(
  input: string,
  recentExpenses: Array<{ description: string; category: string }> = [],
): Promise<ParsedExpense | null> {
  try {
    const historyLines = recentExpenses.length
      ? recentExpenses
          .slice(0, 20)
          .map((e) => `"${e.description}" → ${e.category}`)
          .join('\n')
      : '';

    const historyBlock = historyLines
      ? `\nHistorial reciente del usuario (usalo para aprender sus preferencias):\n${historyLines}\n`
      : '';

    const prompt = `Sos un parser de gastos argentinos. Dada la entrada del usuario, extraé el monto en pesos argentinos y la categoría.
Categorías válidas: ${CATEGORY_NAMES.join(', ')}.
${historyBlock}
Respondé SOLO con JSON: {"amount": number, "category": "string", "description": "string"}
Si dice "k" después de un número, multiplicá por 1000 (ej: "10k" = 10000).
Entrada: "${input}"`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
    });

    const text = result.response.text();
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
  try {
    const balance = totalIncome - totalExpenses;
    const prompt = `Sos un asesor financiero personal argentino. Da UN consejo breve y práctico en máximo 3 oraciones cortas. No uses la palabra "urgente". No repitas los datos, solo da el consejo.

Gastos: $${totalExpenses.toLocaleString('es-AR')} | Ingresos: $${totalIncome.toLocaleString('es-AR')} | Balance: $${balance.toLocaleString('es-AR')}
Categorías: ${categoryBreakdown}
Tags: ${tagBreakdown}

Respondé solo con el consejo, sin formato markdown ni bullets.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
    });

    return result.response.text().trim();
  } catch {
    return '';
  }
}
