/* ==========================================================================
   OVERCLOCK — components.js

   Carga los componentes compartidos del sitio:

   components/header.html
   components/auth-modal.html

   Cada página solo necesita tener:

   <div id="site-header"></div>
   <div id="auth-container"></div>

   ========================================================================== */

(function () {

  async function loadComponent(containerId, filePath) {

    const container = document.getElementById(containerId);

    if (!container) {
      return;
    }

    try {

      const response = await fetch(filePath, {
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(
          `No se pudo cargar ${filePath}: ${response.status}`
        );
      }

      const html = await response.text();

      container.innerHTML = html;

    } catch (error) {

      console.error(
        `Error cargando el componente ${filePath}:`,
        error
      );

    }

  }


  async function loadComponents() {

    /*
     * Cargamos primero el header y después el modal.
     * Así nos aseguramos de que ambos estén presentes
     * antes de inicializar la autenticación.
     */

    await loadComponent(
      'site-header',
      'components/header.html'
    );

    await loadComponent(
      'auth-container',
      'components/auth-modal.html'
    );

    /*
     * Avisamos a auth.js de que los componentes
     * ya fueron cargados.
     */

    document.dispatchEvent(
      new CustomEvent('overclock:components-ready')
    );

  }


  /*
   * Esperamos a que el HTML de la página esté listo.
   */

  if (document.readyState === 'loading') {

    document.addEventListener(
      'DOMContentLoaded',
      loadComponents
    );

  } else {

    loadComponents();

  }

})();
