/* ==========================================================================
   OVERCLOCK — auth.js
   Autenticación + menú compartido

   IMPORTANTE:
   - components.js carga primero:
       components/header.html
       components/auth-modal.html
   - Después dispara:
       overclock:components-ready
   - Este archivo espera ese evento antes de inicializar el sistema.

   Requiere:
     @supabase/supabase-js@2
     components.js

   Expone:
     window.supabaseClient
     window.ocAuth
   ========================================================================== */

const SUPABASE_URL = 'https://jhqjzxotxyxhvxdtuzxu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KA9m4jldQbksI7WmTimR8Q_KNXHrevT';

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

window.supabaseClient = supabaseClient;


/* ==========================================================================
   AUTENTICACIÓN
   ========================================================================== */

const ocAuth = (() => {

  let currentUser = null;
  const listeners = [];

  function $(id) {
    return document.getElementById(id);
  }


  /* ========================================================================
     INICIALIZAR ELEMENTOS DEL HEADER Y LOGIN
     ======================================================================== */

  function initUI() {

    /* ----------------------------------------------------------------------
       Elementos del menú
       ---------------------------------------------------------------------- */

    const menu = $('menu');
    const menuToggle = $('menuToggle');
    const menuIndicator = $('menuIndicator');


    /* ----------------------------------------------------------------------
       MENÚ DESPLEGABLE
       ---------------------------------------------------------------------- */

    if (menu && menuToggle) {

      menuToggle.addEventListener('click', (e) => {

        e.stopPropagation();

        const isOpen = menu.classList.toggle('open');

        menuToggle.setAttribute(
          'aria-expanded',
          String(isOpen)
        );

        if (menuIndicator) {
          menuIndicator.textContent =
            isOpen ? '︿' : '﹀';
        }

        document.body.classList.toggle(
          'menu-open',
          isOpen
        );

      });


      /*
       * Cerrar menú al hacer click fuera.
       */

      document.addEventListener('click', (e) => {

        if (
          menu.classList.contains('open') &&
          !menu.contains(e.target)
        ) {

          closeMenu();

        }

      });


      /*
       * Cerrar menú con Escape.
       */

      document.addEventListener('keydown', (e) => {

        if (
          e.key === 'Escape' &&
          menu.classList.contains('open')
        ) {

          closeMenu();

        }

      });

    }


    function closeMenu() {

      if (!menu) return;

      menu.classList.remove('open');

      menuToggle?.setAttribute(
        'aria-expanded',
        'false'
      );

      if (menuIndicator) {
        menuIndicator.textContent = '﹀';
      }

      /*
       * Solo quitamos menu-open si ningún modal
       * está abierto.
       */

      if (
        !$('authOverlay')?.classList.contains('open') &&
        !$('reviewOverlay')?.classList.contains('open')
      ) {

        document.body.classList.remove('menu-open');

      }

    }


    /* ======================================================================
       ACTUALIZAR HEADER SEGÚN SESIÓN
       ====================================================================== */

    function updateHeaderUI() {

      const loginTrigger = $('loginTrigger');

      if (loginTrigger) {

        if (currentUser) {

          loginTrigger.textContent = 'Perfil';
          loginTrigger.setAttribute(
            'href',
            'perfil.html'
          );

        } else {

          loginTrigger.textContent = 'Iniciar sesión';
          loginTrigger.setAttribute(
            'href',
            '#'
          );

        }

      }


      /*
       * Sistema utilizado por index.html
       */

      const menuItemProfile = $('menuItemProfile');
      const menuItemLogin = $('menuItemLogin');
      const menuItemLogout = $('menuItemLogout');

      if (
        menuItemProfile ||
        menuItemLogin ||
        menuItemLogout
      ) {

        menuItemProfile?.classList.toggle(
          'visible',
          !!currentUser
        );

        menuItemLogin?.classList.toggle(
          'hidden',
          !!currentUser
        );

        menuItemLogout?.classList.toggle(
          'visible',
          !!currentUser
        );

      }


      /*
       * Compatibilidad con páginas antiguas
       * que puedan usar estos IDs.
       */

      const menuPerfil = $('menuPerfil');
      const menuLogout = $('menuLogout');

      if (menuPerfil) {
        menuPerfil.hidden = !currentUser;
      }

      if (menuLogout) {
        menuLogout.hidden = !currentUser;
      }


      /*
       * Avisar a otras partes del sitio.
       */

      listeners.forEach(fn => {

        try {
          fn(currentUser);
        } catch (error) {
          console.error(
            'Error en listener de ocAuth:',
            error
          );
        }

      });

    }


    /* ======================================================================
       MODAL DE AUTENTICACIÓN
       ====================================================================== */

    const authOverlay = $('authOverlay');


    function showAuthError(message) {

      const el = $('authError');

      if (!el) return;

      el.textContent = message;
      el.classList.add('visible');

    }


    function clearAuthError() {

      const el = $('authError');

      if (!el) return;

      el.textContent = '';
      el.classList.remove('visible');

    }


    function openAuth(mode = 'login', message = null) {

      if (!authOverlay) {
        console.warn(
          'No se encontró #authOverlay.'
        );
        return;
      }

      clearAuthError();

      authOverlay.classList.add('open');

      document.body.classList.add(
        'menu-open'
      );

      setAuthMode(mode);

      if (message) {

        const subheading =
          $('authSubheading');

        if (subheading) {
          subheading.textContent = message;
        }

      }

    }


    function closeAuth() {

      if (!authOverlay) return;

      authOverlay.classList.remove('open');

      /*
       * Si no hay otro modal abierto,
       * permitimos nuevamente el scroll.
       */

      if (
        !$('reviewOverlay')?.classList.contains('open')
      ) {

        document.body.classList.remove(
          'menu-open'
        );

      }

    }


    function setAuthMode(mode) {

      const isLogin = mode === 'login';

      clearAuthError();


      $('tabLogin')?.classList.toggle(
        'active',
        isLogin
      );

      $('tabRegister')?.classList.toggle(
        'active',
        !isLogin
      );


      $('formLogin')?.classList.toggle(
        'active',
        isLogin
      );

      $('formRegister')?.classList.toggle(
        'active',
        !isLogin
      );


      const heading = $('authHeading');

      if (heading) {

        heading.textContent = isLogin
          ? 'Iniciar sesión'
          : 'Crear cuenta';

      }


      const subheading =
        $('authSubheading');

      if (subheading) {

        subheading.textContent = isLogin
          ? 'Entra para seguir tus recomendaciones'
          : 'Únete para guardar tus preferencias';

      }


      /*
       * Cambiar enlace inferior
       */

      const authSwitch =
        $('authSwitch');

      if (authSwitch) {

        authSwitch.innerHTML = isLogin
          ? '¿No tienes cuenta? <button type="button" id="switchToRegister">Crear una</button>'
          : '¿Ya tienes cuenta? <button type="button" id="switchToLogin">Iniciar sesión</button>';

        const switchButton =
          authSwitch.querySelector('button');

        if (switchButton) {

          switchButton.addEventListener(
            'click',
            () => {

              setAuthMode(
                isLogin
                  ? 'register'
                  : 'login'
              );

            }
          );

        }

      }

    }


    /* ======================================================================
       EVENTOS DEL LOGIN
       ====================================================================== */

    if (authOverlay) {


      /* --------------------------------------------------------------------
         Botón principal "Iniciar sesión / Perfil"
         -------------------------------------------------------------------- */

      $('loginTrigger')?.addEventListener(
        'click',
        (e) => {

          if (currentUser) {

            /*
             * Usuario logueado:
             * permite ir a perfil.html.
             */

            return;

          }

          e.preventDefault();

          openAuth('login');

        }
      );


      /* --------------------------------------------------------------------
         Iniciar sesión desde el menú
         -------------------------------------------------------------------- */

      $('menuItemLogin')?.addEventListener(
        'click',
        (e) => {

          if (currentUser) return;

          e.preventDefault();

          closeMenu();

          openAuth('login');

        }
      );


      /* --------------------------------------------------------------------
         Cerrar modal
         -------------------------------------------------------------------- */

      $('authClose')?.addEventListener(
        'click',
        closeAuth
      );


      /*
       * Cerrar haciendo click en el fondo.
       */

      authOverlay.addEventListener(
        'click',
        (e) => {

          if (e.target === authOverlay) {

            closeAuth();

          }

        }
      );


      /*
       * Cerrar con Escape.
       */

      document.addEventListener(
        'keydown',
        (e) => {

          if (
            e.key === 'Escape' &&
            authOverlay.classList.contains('open')
          ) {

            closeAuth();

          }

        }
      );


      /* --------------------------------------------------------------------
         Pestañas
         -------------------------------------------------------------------- */

      $('tabLogin')?.addEventListener(
        'click',
        () => setAuthMode('login')
      );

      $('tabRegister')?.addEventListener(
        'click',
        () => setAuthMode('register')
      );


      /* ====================================================================
         GITHUB
         ==================================================================== */

      $('githubLogin')?.addEventListener(
        'click',
        async () => {

          clearAuthError();

          const {
            error
          } = await supabaseClient.auth.signInWithOAuth({

            provider: 'github',

            options: {
              redirectTo:
                window.location.href.split('#')[0]
            }

          });

          if (error) {

            showAuthError(
              'No se pudo iniciar sesión con GitHub: ' +
              error.message
            );

          }

        }
      );


      /* ====================================================================
         LOGIN CON CORREO
         ==================================================================== */

      $('formLogin')?.addEventListener(
        'submit',
        async (e) => {

          e.preventDefault();

          clearAuthError();

          const email =
            $('loginEmail')
              ?.value
              .trim();

          const password =
            $('loginPassword')
              ?.value;

          const submitBtn =
            e.target.querySelector(
              '.auth-submit'
            );


          if (!email || !password) {
            return;
          }


          if (submitBtn) {

            submitBtn.disabled = true;
            submitBtn.textContent =
              'Entrando…';

          }


          const {
            data,
            error
          } =
            await supabaseClient.auth.signInWithPassword({
              email,
              password
            });


          if (submitBtn) {

            submitBtn.disabled = false;
            submitBtn.textContent =
              'Iniciar sesión';

          }


          if (error) {

            showAuthError(
              error.message ===
              'Invalid login credentials'

                ? 'Correo o contraseña incorrectos.'

                : error.message
            );

            return;

          }


          currentUser =
            data.user || null;

          updateHeaderUI();

          closeAuth();

        }
      );


      /* ====================================================================
         REGISTRO
         ==================================================================== */

      $('formRegister')?.addEventListener(
        'submit',
        async (e) => {

          e.preventDefault();

          clearAuthError();


          const email =
            $('registerEmail')
              ?.value
              .trim();

          const password =
            $('registerPassword')
              ?.value;

          const confirm =
            $('registerConfirm')
              ?.value;


          if (password !== confirm) {

            showAuthError(
              'Las contraseñas no coinciden.'
            );

            return;

          }


          if (password.length < 6) {

            showAuthError(
              'La contraseña debe tener al menos 6 caracteres.'
            );

            return;

          }


          const submitBtn =
            e.target.querySelector(
              '.auth-submit'
            );


          if (submitBtn) {

            submitBtn.disabled = true;
            submitBtn.textContent =
              'Creando cuenta…';

          }


          const {
            data,
            error
          } =
            await supabaseClient.auth.signUp({
              email,
              password
            });


          if (submitBtn) {

            submitBtn.disabled = false;
            submitBtn.textContent =
              'Crear cuenta';

          }


          if (error) {

            showAuthError(
              error.message
            );

            return;

          }


          /*
           * Supabase puede requerir confirmación
           * del correo antes de crear una sesión.
           */

          if (!data.session) {

            showAuthError(
              'Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.'
            );

            e.target.reset();

            return;

          }


          currentUser =
            data.user || null;

          updateHeaderUI();

          closeAuth();

        }
      );

    }


    /* ======================================================================
       LOGOUT
       ====================================================================== */

    async function doLogout(e) {

      e.preventDefault();

      try {

        await supabaseClient.auth.signOut();

      } catch (error) {

        console.error(
          'Error cerrando sesión:',
          error
        );

      }

      currentUser = null;

      updateHeaderUI();

      closeMenu();

    }


    $('menuItemLogout')?.addEventListener(
      'click',
      doLogout
    );

    $('menuLogout')?.addEventListener(
      'click',
      doLogout
    );


    /*
     * Primera actualización del header.
     */

    updateHeaderUI();

  }


  /* ==========================================================================
     CAMBIO DE SESIÓN DE SUPABASE
     ========================================================================== */

  supabaseClient.auth.onAuthStateChange(
    (_event, session) => {

      currentUser =
        session
          ? session.user
          : null;

      /*
       * Los componentes ya deberían existir,
       * pero comprobamos por seguridad.
       */

      if (document.getElementById('menu')) {
        initUIUpdateOnly();
      }

      if (currentUser) {

        const authOverlay =
          document.getElementById(
            'authOverlay'
          );

        if (authOverlay) {
          authOverlay.classList.remove('open');
        }

      }

    }
  );


  /*
   * Actualización ligera del header después
   * de un cambio de sesión.
   */

  function initUIUpdateOnly() {

    const loginTrigger =
      document.getElementById(
        'loginTrigger'
      );

    if (loginTrigger) {

      if (currentUser) {

        loginTrigger.textContent =
          'Perfil';

        loginTrigger.setAttribute(
          'href',
          'perfil.html'
        );

      } else {

        loginTrigger.textContent =
          'Iniciar sesión';

        loginTrigger.setAttribute(
          'href',
          '#'
        );

      }

    }


    const profile =
      document.getElementById(
        'menuItemProfile'
      );

    const login =
      document.getElementById(
        'menuItemLogin'
      );

    const logout =
      document.getElementById(
        'menuItemLogout'
      );


    profile?.classList.toggle(
      'visible',
      !!currentUser
    );

    login?.classList.toggle(
      'hidden',
      !!currentUser
    );

    logout?.classList.toggle(
      'visible',
      !!currentUser
    );


    listeners.forEach(fn => {

      try {
        fn(currentUser);
      } catch (error) {
        console.error(error);
      }

    });

  }


  /* ==========================================================================
     SESIÓN INICIAL
     ========================================================================== */

  async function initSession() {

    try {

      const {
        data: { session }
      } =
        await supabaseClient.auth.getSession();

      currentUser =
        session
          ? session.user
          : null;

    } catch (error) {

      console.error(
        'Error obteniendo sesión:',
        error
      );

      currentUser = null;

    }

  }


  /* ==========================================================================
     ESPERAR A QUE components.js TERMINE
     ========================================================================== */

  document.addEventListener(
    'overclock:components-ready',
    async () => {

      /*
       * Primero obtenemos la sesión.
       */

      await initSession();

      /*
       * Después inicializamos todos los botones
       * y elementos del menú/login.
       */

      initUI();

    },
    { once: true }
  );


  /* ==========================================================================
     API PÚBLICA
     ========================================================================== */

  return {

    get currentUser() {
      return currentUser;
    },

    openAuth(mode = 'login') {

      /*
       * Si los componentes ya fueron cargados,
       * buscamos el modal directamente.
       */

      const overlay =
        document.getElementById(
          'authOverlay'
        );

      if (!overlay) {

        console.warn(
          'El modal de autenticación todavía no está disponible.'
        );

        return;

      }

      overlay.classList.add('open');

      document.body.classList.add(
        'menu-open'
      );

    },

    closeAuth() {

      const overlay =
        document.getElementById(
          'authOverlay'
        );

      overlay?.classList.remove(
        'open'
      );

      document.body.classList.remove(
        'menu-open'
      );

    },

    onChange(fn) {

      if (
        typeof fn === 'function'
      ) {

        listeners.push(fn);

      }

    }

  };

})();


window.ocAuth = ocAuth;
