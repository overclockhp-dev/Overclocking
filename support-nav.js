/* ==========================================================================
   OVERCLOCK — support-nav.js
   Barra compartida: Actualizaciones · Reporte · Contacto · Actividad

   Uso en cualquier página:
     1. Coloca <div id="support-nav-container"></div> bajo el menú
        (o no pongas nada: se insertará tras #menu-container).
     2. <script src="support-nav.js"></script>

   Para añadir o quitar pestañas, edita solo SUPPORT_NAV_ITEMS abajo.
   ========================================================================== */

const SUPPORT_NAV_ITEMS = [
  { href: 'actualizaciones.html', label: 'Actualizaciones' },
  { href: 'reporte.html',         label: 'Reporte' },
  { href: 'contacto.html',        label: 'Contacto' },
  { href: 'actividad.html',       label: 'Actividad' },
];

const SUPPORT_NAV_CSS = `
  .subnav-wrap{
    border-bottom:1px solid var(--line, #1E1E1C);
    background:#050505;
  }
  .subnav{
    max-width:860px;
    margin:0 auto;
    padding:0 32px;
    display:flex;
    gap:0;
    overflow-x:auto;
    -webkit-overflow-scrolling:touch;
  }
  .subnav a{
    flex-shrink:0;
    color:var(--fg-dim, #8A8A85);
    text-decoration:none;
    font-family:inherit;
    font-size:0.88rem;
    font-weight:500;
    padding:14px 18px;
    border-bottom:2px solid transparent;
    transition:color .2s ease, border-color .2s ease;
  }
  .subnav a:hover{ color:var(--fg, #F4F4F1); }
  .subnav a.active{
    color:var(--accent, #E4293B);
    border-bottom-color:var(--accent, #E4293B);
  }
  @media (max-width:560px){
    .subnav{ padding:0 12px; }
    .subnav a{ padding:12px 14px; font-size:0.84rem; }
  }
`;

function getCurrentPageName() {
  const path = (window.location.pathname || '').replace(/\\/g, '/');
  const file = path.split('/').pop() || '';
  return file.toLowerCase() || 'index.html';
}

function buildSupportNavHtml() {
  const current = getCurrentPageName();
  const links = SUPPORT_NAV_ITEMS.map((item) => {
    const file = item.href.toLowerCase();
    const active = current === file || current.endsWith('/' + file);
    return `<a href="${item.href}"${active ? ' class="active"' : ''}>${item.label}</a>`;
  }).join('');

  return `
    <div class="subnav-wrap">
      <nav class="subnav" aria-label="Secciones de soporte">
        ${links}
      </nav>
    </div>
  `;
}

function injectSupportNavStyles() {
  if (document.getElementById('support-nav-styles')) return;
  const style = document.createElement('style');
  style.id = 'support-nav-styles';
  style.textContent = SUPPORT_NAV_CSS;
  document.head.appendChild(style);
}

function mountSupportNav() {
  injectSupportNavStyles();
  const html = buildSupportNavHtml();

  let container = document.getElementById('support-nav-container');
  if (container) {
    container.innerHTML = html;
    return;
  }

  // Si no hay contenedor, insertar después del menú o al inicio del body
  const menu = document.getElementById('menu-container');
  const wrapper = document.createElement('div');
  wrapper.id = 'support-nav-container';
  wrapper.innerHTML = html;

  if (menu && menu.parentNode) {
    menu.insertAdjacentElement('afterend', wrapper);
  } else {
    document.body.insertAdjacentElement('afterbegin', wrapper);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountSupportNav);
} else {
  mountSupportNav();
}
