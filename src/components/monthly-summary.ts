import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { categoryEmoji, CATEGORY_NAMES } from '../lib/categories';
import { formatCurrency, startOfMonth, endOfMonth, monthLabel } from '../lib/format';
import { esc } from '../lib/sanitize';
import { getFinancialTip } from '../lib/gemini';
import type { Expense } from '../lib/types';

export function renderMonthlySummary(container: HTMLElement) {
  let currentMonth = new Date();

  async function render() {
    const start = Timestamp.fromDate(startOfMonth(currentMonth));
    const end = Timestamp.fromDate(endOfMonth(currentMonth));

    container.innerHTML = `
      <div class="month-nav">
        <button class="btn btn-secondary" id="prev-month">&larr;</button>
        <span class="month-label">${esc(monthLabel(currentMonth))}</span>
        <button class="btn btn-secondary" id="next-month">&rarr;</button>
      </div>
      <p class="loading">Cargando resumen...</p>
    `;

    bindNav();

    const [expenseSnap, incomeSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'expenses'),
          where('date', '>=', start),
          where('date', '<=', end),
          orderBy('date', 'desc'),
        ),
      ),
      getDocs(
        query(
          collection(db, 'incomes'),
          where('date', '>=', start),
          where('date', '<=', end),
        ),
      ),
    ]);

    const expenses = expenseSnap.docs.map((d) => d.data() as Expense);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalIncome = incomeSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);
    const balance = totalIncome - totalExpenses;

    const byCategory: Record<string, number> = {};
    const byTag: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      if (e.tags) {
        for (const t of e.tags) {
          byTag[t] = (byTag[t] || 0) + e.amount;
        }
      }
    }

    const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

    const categoryBreakdown = sortedCats
      .map(([cat, amt]) => `${cat}: $${amt.toLocaleString('es-AR')}`)
      .join('\n');

    const tagBreakdown = Object.entries(byTag).length
      ? Object.entries(byTag)
          .sort((a, b) => b[1] - a[1])
          .map(([tag, amt]) => `${tag}: $${amt.toLocaleString('es-AR')}`)
          .join('\n')
      : 'Sin tags asignados';

    const tip = await getCachedTip(
      currentMonth,
      categoryBreakdown,
      tagBreakdown,
      totalExpenses,
      totalIncome,
    );

    const balanceClass = balance >= 0 ? 'stat-green' : 'stat-red';

    container.innerHTML = `
      <div class="month-nav">
        <button class="btn btn-secondary" id="prev-month">&larr;</button>
        <span class="month-label">${esc(monthLabel(currentMonth))}</span>
        <button class="btn btn-secondary" id="next-month">&rarr;</button>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value stat-green">${formatCurrency(totalIncome)}</div>
          <div class="stat-label">Ingresos</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(totalExpenses)}</div>
          <div class="stat-label">Gastos</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${balanceClass}">${formatCurrency(balance)}</div>
          <div class="stat-label">Balance</div>
        </div>
      </div>

      ${
        tip
          ? `<div class="card tip-card">
              <div class="tip-label">💡 Consejo del dia</div>
              <p>${esc(tip)}</p>
            </div>`
          : ''
      }

      <div class="card">
        <h3>Por Categoria</h3>
        ${
          sortedCats.length === 0
            ? '<p class="empty-state">No hay gastos este mes</p>'
            : sortedCats
                .map(([cat, amt]) => {
                  const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
                  return `
                  <div class="category-row">
                    <div class="category-info">
                      <span>${categoryEmoji(cat)} ${esc(cat)}</span>
                      <span>${formatCurrency(amt)} (${pct}%)</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill" style="width:${pct}%"></div>
                    </div>
                  </div>
                `;
                })
                .join('')
        }
      </div>

      ${
        Object.keys(byTag).length > 0
          ? `<div class="card">
              <h3>Por Tag</h3>
              ${Object.entries(byTag)
                .sort((a, b) => b[1] - a[1])
                .map(([tag, amt]) => {
                  const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
                  return `
                  <div class="category-row">
                    <div class="category-info">
                      <span>${esc(tag)}</span>
                      <span>${formatCurrency(amt)} (${pct}%)</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill accent" style="width:${pct}%"></div>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>`
          : ''
      }
    `;

    bindNav();
  }

  function bindNav() {
    document.getElementById('prev-month')?.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      render();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      render();
    });
  }

  render();
}

async function getCachedTip(
  month: Date,
  categoryBreakdown: string,
  tagBreakdown: string,
  totalExpenses: number,
  totalIncome: number,
): Promise<string> {
  const today = new Date();
  const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;
  const key = `misgastos_tip_${monthKey}_${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

  const cached = localStorage.getItem(key);
  if (cached) return cached;

  cleanOldTips(key);

  if (totalExpenses === 0) return '';

  const tip = await getFinancialTip(categoryBreakdown, tagBreakdown, totalExpenses, totalIncome);
  if (tip) localStorage.setItem(key, tip);
  return tip;
}

function cleanOldTips(currentKey: string) {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('misgastos_tip_'));
  for (const k of keys) {
    if (k !== currentKey) localStorage.removeItem(k);
  }
}
