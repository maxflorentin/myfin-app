import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { categoryEmoji, CATEGORY_NAMES } from '../lib/categories';
import { formatCurrency, formatDate, startOfMonth, endOfMonth, monthLabel } from '../lib/format';
import { esc } from '../lib/sanitize';
import { showToast } from '../lib/toast';
import { openExpenseDetail } from './expense-detail';
import type { Expense } from '../lib/types';

let unsub: (() => void) | null = null;

export function renderExpenseList(container: HTMLElement) {
  let currentMonth = new Date();
  let categoryFilter = '';
  let expenses: Expense[] = [];

  function render() {
    const start = Timestamp.fromDate(startOfMonth(currentMonth));
    const end = Timestamp.fromDate(endOfMonth(currentMonth));

    if (unsub) unsub();

    const q = query(
      collection(db, 'expenses'),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date', 'desc'),
    );

    unsub = onSnapshot(
      q,
      (snap) => {
        expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense);
        renderList();
      },
      () => showToast('Error cargando gastos', 'error'),
    );
  }

  function renderList() {
    const filtered = categoryFilter
      ? expenses.filter((e) => e.category === categoryFilter)
      : expenses;

    const total = filtered.reduce((s, e) => s + e.amount, 0);
    const avg = filtered.length ? Math.round(total / filtered.length) : 0;

    const filterOptions = CATEGORY_NAMES.map(
      (c) =>
        `<option value="${esc(c)}" ${categoryFilter === c ? 'selected' : ''}>${categoryEmoji(c)} ${esc(c)}</option>`,
    ).join('');

    container.innerHTML = `
      <div class="month-nav">
        <button class="btn btn-secondary" id="prev-month">&larr;</button>
        <span class="month-label">${esc(monthLabel(currentMonth))}</span>
        <button class="btn btn-secondary" id="next-month">&rarr;</button>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(total)}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(avg)}</div>
          <div class="stat-label">Promedio</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${filtered.length}</div>
          <div class="stat-label">Gastos</div>
        </div>
      </div>

      <div class="filter-row">
        <select id="category-filter" class="input input-sm">
          <option value="">Todas las categorias</option>
          ${filterOptions}
        </select>
      </div>

      <div class="expense-items">
        ${filtered.length === 0 ? '<p class="empty-state">No hay gastos este mes</p>' : ''}
        ${filtered
          .map(
            (e) => `
          <div class="item-card item-card-tap" data-id="${e.id}">
            <div class="item-card-left">
              <span class="item-emoji">${categoryEmoji(e.category)}</span>
              <div>
                <div class="item-title">${esc(e.description)}</div>
                <div class="item-meta">
                  ${esc(formatDate(e.date))}
                  <span class="badge">${esc(e.category)}</span>
                  ${e.paymentMethod ? `<span class="badge">${esc(e.paymentMethod)}</span>` : ''}
                  ${e.installments && e.installments > 1 ? `<span class="badge">${e.installments} cuotas</span>` : ''}
                  ${(e.tags || []).map((t) => `<span class="badge badge-accent">${esc(t)}</span>`).join('')}
                </div>
              </div>
            </div>
            <div class="item-card-right">
              <span class="item-amount">${formatCurrency(e.amount)}</span>
              <button class="btn-icon delete-btn" data-delete="${e.id}" title="Eliminar">&times;</button>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    `;

    document.getElementById('prev-month')!.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      render();
    });

    document.getElementById('next-month')!.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      render();
    });

    document.getElementById('category-filter')!.addEventListener('change', (e) => {
      categoryFilter = (e.target as HTMLSelectElement).value;
      renderList();
    });

    container.querySelectorAll('.item-card-tap').forEach((card) => {
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.delete-btn')) return;
        const id = (card as HTMLElement).dataset.id;
        const expense = expenses.find((ex) => ex.id === id);
        if (expense) openExpenseDetail(expense);
      });
    });

    container.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.delete!;
        if (!confirm('Eliminar este gasto?')) return;
        try {
          await deleteDoc(doc(db, 'expenses', id));
          showToast('Gasto eliminado');
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
