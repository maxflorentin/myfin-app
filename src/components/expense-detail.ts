import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { esc } from '../lib/sanitize';
import { showToast } from '../lib/toast';
import type { Expense, PaymentMethod } from '../lib/types';
import { SUGGESTED_TAGS } from '../lib/types';

const PAYMENT_METHODS: PaymentMethod[] = ['Efectivo', 'Debito', 'Credito', 'Transferencia'];

export function openExpenseDetail(expense: Expense) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const tagsHtml = SUGGESTED_TAGS.map(
    (t) =>
      `<button type="button" class="tag-chip ${expense.tags?.includes(t) ? 'active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`,
  ).join('');

  const customTags = (expense.tags || []).filter(
    (t) => !(SUGGESTED_TAGS as readonly string[]).includes(t),
  );

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Detalle del Gasto</h3>
        <button class="modal-close" id="modal-close">&times;</button>
      </div>
      <form id="detail-form">
        <div class="form-group">
          <label class="label">Metodo de pago</label>
          <select id="detail-payment" class="input">
            <option value="">Sin especificar</option>
            ${PAYMENT_METHODS.map(
              (m) =>
                `<option value="${esc(m)}" ${expense.paymentMethod === m ? 'selected' : ''}>${esc(m)}</option>`,
            ).join('')}
          </select>
        </div>
        <div class="form-group" id="installments-group" style="display:${expense.paymentMethod === 'Credito' ? 'block' : 'none'}">
          <label class="label">Cuotas</label>
          <input type="number" id="detail-installments" class="input" min="1" max="48" value="${expense.installments || 1}" />
        </div>
        <div class="form-group">
          <label class="label">Tags</label>
          <div class="tag-chips">${tagsHtml}</div>
          <div class="custom-tags">
            ${customTags.map((t) => `<span class="tag-chip active" data-tag="${esc(t)}">${esc(t)} &times;</span>`).join('')}
          </div>
          <div class="tag-add-row">
            <input type="text" id="custom-tag-input" class="input" placeholder="Agregar tag..." maxlength="30" />
            <button type="button" class="btn btn-secondary" id="add-custom-tag">+</button>
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%">Guardar</button>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const paymentSelect = document.getElementById('detail-payment') as HTMLSelectElement;
  const installmentsGroup = document.getElementById('installments-group')!;

  paymentSelect.addEventListener('change', () => {
    installmentsGroup.style.display = paymentSelect.value === 'Credito' ? 'block' : 'none';
  });

  overlay.querySelectorAll('.tag-chip').forEach((chip) => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });

  document.getElementById('add-custom-tag')!.addEventListener('click', () => {
    const input = document.getElementById('custom-tag-input') as HTMLInputElement;
    const val = input.value.trim();
    if (!val) return;

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-chip active';
    chip.dataset.tag = val;
    chip.textContent = val;
    chip.addEventListener('click', () => chip.classList.toggle('active'));

    overlay.querySelector('.tag-chips')!.appendChild(chip);
    input.value = '';
  });

  document.getElementById('modal-close')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.getElementById('detail-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!expense.id) return;

    const payment = paymentSelect.value as PaymentMethod | '';
    const installments = parseInt(
      (document.getElementById('detail-installments') as HTMLInputElement).value,
      10,
    );

    const activeTags: string[] = [];
    overlay.querySelectorAll('.tag-chip.active').forEach((el) => {
      const tag = (el as HTMLElement).dataset.tag;
      if (tag) activeTags.push(tag);
    });

    const updates: Record<string, unknown> = {
      tags: activeTags,
    };
    if (payment) {
      updates.paymentMethod = payment;
      if (payment === 'Credito' && installments > 1) {
        updates.installments = installments;
      }
    }

    try {
      await updateDoc(doc(db, 'expenses', expense.id), updates);
      showToast('Detalle actualizado');
      overlay.remove();
    } catch {
      showToast('Error al actualizar', 'error');
    }
  });
}
