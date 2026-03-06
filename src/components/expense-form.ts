import { collection, addDoc, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { CATEGORY_NAMES, CATEGORIES } from '../lib/categories';
import { toInputDate } from '../lib/format';
import { parseExpenseInput } from '../lib/gemini';
import { showToast } from '../lib/toast';
import { esc } from '../lib/sanitize';

export function renderExpenseForm(container: HTMLElement) {
  const today = toInputDate(new Date());

  const categoryOptions = CATEGORY_NAMES.map(
    (c) => `<option value="${esc(c)}">${CATEGORIES[c]} ${esc(c)}</option>`,
  ).join('');

  container.innerHTML = `
    <div class="card">
      <h2>Agregar Gasto</h2>
      <div class="smart-input-section">
        <label class="label">Entrada rapida</label>
        <div class="smart-input-row">
          <input type="text" id="smart-input" class="input" placeholder="ej: super 10k, nafta 5000" />
          <button class="btn btn-primary" id="smart-parse">Enviar</button>
        </div>
        <p class="hint" id="smart-hint"></p>
      </div>
    </div>

    <div class="card">
      <h3>Formulario Manual</h3>
      <form id="expense-form">
        <div class="form-group">
          <label class="label" for="amount">Monto ($)</label>
          <input type="number" id="amount" class="input" min="1" step="1" required />
        </div>
        <div class="form-group">
          <label class="label" for="category">Categoria</label>
          <select id="category" class="input" required>
            ${categoryOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="label" for="description">Descripcion</label>
          <input type="text" id="description" class="input" maxlength="200" required />
        </div>
        <div class="form-group">
          <label class="label" for="date">Fecha</label>
          <input type="date" id="date" class="input" value="${today}" required />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%">Guardar</button>
      </form>
    </div>
  `;

  const smartInput = document.getElementById('smart-input') as HTMLInputElement;
  const smartBtn = document.getElementById('smart-parse')!;
  const smartHint = document.getElementById('smart-hint')!;
  const form = document.getElementById('expense-form') as HTMLFormElement;

  smartBtn.addEventListener('click', async () => {
    const text = smartInput.value.trim();
    if (!text) return;

    smartBtn.textContent = '...';
    smartHint.textContent = 'Procesando...';

    let recent: Array<{ description: string; category: string }> = [];
    try {
      const snap = await getDocs(
        query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(20)),
      );
      recent = snap.docs.map((d) => ({
        description: d.data().description || '',
        category: d.data().category || '',
      }));
    } catch { /* ignore */ }

    const parsed = await parseExpenseInput(text, recent);

    if (parsed) {
      (document.getElementById('amount') as HTMLInputElement).value = String(parsed.amount);
      (document.getElementById('category') as HTMLSelectElement).value = parsed.category;
      (document.getElementById('description') as HTMLInputElement).value = parsed.description;
      smartHint.textContent = `${CATEGORIES[parsed.category] || ''} ${parsed.category} - $${parsed.amount.toLocaleString('es-AR')}`;
    } else {
      smartHint.textContent = 'No pude parsear el gasto. Probalo manual.';
    }

    smartBtn.textContent = 'Enviar';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const amount = parseInt((document.getElementById('amount') as HTMLInputElement).value, 10);
    const category = (document.getElementById('category') as HTMLSelectElement).value;
    const description = (document.getElementById('description') as HTMLInputElement).value.trim();
    const dateVal = (document.getElementById('date') as HTMLInputElement).value;
    const parsedFrom = smartInput.value.trim();

    if (amount <= 0) {
      showToast('El monto debe ser mayor a 0', 'error');
      return;
    }

    try {
      const dateObj = new Date(dateVal + 'T12:00:00');
      await addDoc(collection(db, 'expenses'), {
        amount,
        category,
        description: description.slice(0, 200),
        date: Timestamp.fromDate(dateObj),
        createdAt: Timestamp.now(),
        createdBy: user.uid,
        createdByEmail: user.email || '',
        ...(parsedFrom ? { parsedFrom } : {}),
      });
      showToast('Gasto guardado');
      window.location.hash = '#gastos';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      showToast(msg, 'error');
    }
  });
}
