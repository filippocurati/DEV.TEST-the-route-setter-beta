import './style.css';

const app = document.querySelector<HTMLElement>('#app');

if (!app) {
  throw new Error('Contenitore applicativo non disponibile.');
}

app.innerHTML = `
  <section class="bootstrap" aria-labelledby="page-title">
    <p class="eyebrow">Indoor climbing workspace</p>
    <h1 id="page-title">The Route Setter</h1>
    <p>Ambiente applicativo inizializzato.</p>
  </section>
`;
