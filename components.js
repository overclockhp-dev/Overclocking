/* ==========================================================================
   OVERCLOCK — components.js
   Carga los componentes HTML compartidos del sitio.
   ========================================================================== */

async function loadComponent(containerId, file) {

  const container = document.getElementById(containerId);

  if (!container) {
    console.warn(`No existe #${containerId}`);
    return false;
  }

  try {

    const response = await fetch(file);

    if (!response.ok) {
      throw new Error(
        `No se pudo cargar ${file} (${response.status})`
      );
    }

    container.innerHTML = await response.text();

    return true;

  } catch (error) {

    console.error(
      `Error cargando componente ${file}:`,
      error
    );

    return false;

  }

}


/* ==========================================================================
   CARGAR COMPONENTES
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {

  /*
   * Cargar menú
   */

  await loadComponent(
    'menu-container',
    'components/header.html'
  );


  /*
   * Cargar modal de autenticación
   */

  await loadComponent(
    'auth-container',
    'components/auth-modal.html'
  );


  /*
   * Avisar a auth.js de que ambos componentes
   * ya están disponibles en el DOM.
   */

  document.dispatchEvent(
    new CustomEvent('overclock:components-ready')
  );

});
