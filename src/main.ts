import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { renderLogin } from './components/login';
import { renderExpenseList } from './components/expense-list';
import { renderExpenseForm } from './components/expense-form';
import { renderIncome } from './components/income';
import { renderMonthlySummary } from './components/monthly-summary';
import './style.css';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    renderApp();
    window.addEventListener('hashchange', renderApp);
  } else {
    window.removeEventListener('hashchange', renderApp);
    renderLogin(app);
  }
});

function renderApp() {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }

  const hash = window.location.hash || '#gastos';

  app.innerHTML = `
    <header class="app-header">
      <h1 class="app-title">misGastos</h1>
      <button class="btn btn-secondary btn-sm" id="logout-btn">Salir</button>
    </header>
    <nav class="tab-nav">
      <a class="tab ${hash === '#gastos' ? 'active' : ''}" href="#gastos">Gastos</a>
      <a class="tab ${hash === '#agregar' ? 'active' : ''}" href="#agregar">Agregar</a>
      <a class="tab ${hash === '#ingresos' ? 'active' : ''}" href="#ingresos">Ingresos</a>
      <a class="tab ${hash === '#resumen' ? 'active' : ''}" href="#resumen">Resumen</a>
    </nav>
    <main class="content" id="view"></main>
  `;

  document.getElementById('logout-btn')!.addEventListener('click', () => signOut(auth));

  const view = document.getElementById('view')!;

  switch (hash) {
    case '#agregar':
      renderExpenseForm(view);
      break;
    case '#ingresos':
      cleanup = renderIncome(view) || null;
      break;
    case '#resumen':
      renderMonthlySummary(view);
      break;
    default:
      cleanup = renderExpenseList(view) || null;
      break;
  }
}
