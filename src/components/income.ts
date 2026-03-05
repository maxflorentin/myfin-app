import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { formatCurrency, formatDate, toInputDate, startOfMonth, endOfMonth, monthLabel } from '../lib/format';
import { esc } from '../lib/sanitize';
import { showToast } from '../lib/toast';
import type { Income } from '../lib/types';

let unsub: (() => void) | null = null;

export function renderIncome(container: HTMLElement) {
  let currentMonth = new Date();
  let incomes: Income[] = [];
  const today = toInputDate(new Date());

  function render() {
    const start = Timestamp.fromDate(startOfMonth(currentMonth));
    const end = Timestamp.fromDate(endOfMonth(currentMonth));

    if (unsub) unsub();

    const q = query(
      collection(db, 'incomes'),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date', 'desc'),
    );

    unsub = onSnapshot(
      q,
      (snap) => {
        incomes = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Income);
        renderList();
      },
      () => showToast('Error cargando ingresos', 'error'),
    );
  }

  function renderList() {
    const total = incomes.reduce((s, i) => s + i.amount, 0);

    container.innerHTML = `
      <div class="card">
        <h2>Nuevo Ingreso</h2>
        <form id="income-form">
          <div class="form-group">
            <label class="label" for="income-amount">Monto ($)</label>
            <input type="number" id="income-amount" class="input" min="1" step="1" required />
          </div>
          <div class="form-group">
            <label class="label" for="income-desc">Descripcion</label>
            <input type="text" id="income-desc" class="input" maxlength="200" placeholder="ej: Factura monotributo" required />
          </div>
          <div class="form-group">
            <label class="label" for="income-date">Fecha</label>
            <input type="date" id="income-date" class="input" value="${today}" required />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%">Guardar Ingreso</button>
        </form>
      </div>

      <div class="month-nav">
        <button class="btn btn-secondary" id="prev-month">&larr;</button>
        <span class="month-label">${esc(monthLabel(currentMonth))}</span>
        <button class="btn btn-secondary" id="next-month">&rarr;</button>
      </div>

      <div class="stat-grid stat-grid-2">
        <div class="stat-card">
          <div class="stat-value stat-green">${formatCurrency(total)}</div>
          <div class="stat-label">Ingresos del mes</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${incomes.length}</div>
          <div class="stat-label">Facturas</div>
        </div>
      </div>

      <div class="expense-items">
        ${incomes.length === 0 ? '<p class="empty-state">No hay ingresos este mes</p>' : ''}
        ${incomes
          .map(
            (i) => `
          <div class="item-card">
            <div class="item-card-left">
              <span class="item-emoji">💵</span>
              <div>
                <div class="item-title">${esc(i.description)}</div>
                <div class="item-meta">${esc(formatDate(i.date))}</div>
              </div>
            </div>
            <div class="item-card-right">
              <span class="item-amount stat-green">${formatCurrency(i.amount)}</span>
              <button class="btn-icon delete-btn" data-delete="${i.id}" title="Eliminar">&times;</button>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    `;

    document.getElementById('income-form')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user) return;

      const amount = parseInt(
        (document.getElementById('income-amount') as HTMLInputElement).value,
        10,
      );
      const description = (document.getElementById('income-desc') as HTMLInputElement).value.trim();
      const dateVal = (document.getElementById('income-date') as HTMLInputElement).value;

      if (amount <= 0) {
        showToast('El monto debe ser mayor a 0', 'error');
        return;
      }

      try {
        const dateObj = new Date(dateVal + 'T12:00:00');
        await addDoc(collection(db, 'incomes'), {
          amount,
          description: description.slice(0, 200),
          date: Timestamp.fromDate(dateObj),
          createdAt: Timestamp.now(),
          createdBy: user.uid,
          createdByEmail: user.email || '',
        });
        showToast('Ingreso guardado');
        (document.getElementById('income-form') as HTMLFormElement).reset();
        (document.getElementById('income-date') as HTMLInputElement).value = today;
      } catch {
        showToast('Error al guardar', 'error');
      }
    });

    document.getElementById('prev-month')!.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      render();
    });

    document.getElementById('next-month')!.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      render();
    });

    container.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.delete!;
        if (!confirm('Eliminar este ingreso?')) return;
        try {
          await deleteDoc(doc(db, 'incomes', id));
          showToast('Ingreso eliminado');
        } catch {
          showToast('Error al eliminar', 'error');
        }
      });
    });
  }

  render();

  return () => {
    if (unsub) unsub();
  };
}
