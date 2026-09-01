/* ==========================================================================
   OVERCLOCK — auth.js
   Autenticación + menú compartido

   Requiere:
   - @supabase/supabase-js@2
   - components.js
   - components/header.html
   - components/auth-modal.html

   Flujo:
   components.js carga los componentes
           ↓
   overclock:components-ready
           ↓
   auth.js inicializa la interfaz

   Expone:
   window.supabaseClient
   window.ocAuth
   ========================================================================== */


/* ==========================================================================
   SUPABASE
   ========================================================================== */

const SUPABASE_URL =
  'https://jhqjzxotxyxhvxdtuzxu.supabase.co';

const SUPABASE_ANON_KEY =
  'sb_publishable_KA9m4jldQbksI7WmTimR8Q_KNXHrevT';


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

  let componentsReady = false;
  let uiInitialized = false;


  /* ========================================================================
     UTILIDAD
     ======================================================================== */

  function $(id) {
    return document.getElementById(id);
  }


  /* ========================================================================
     ACTUALIZAR HEADER
     
     ESTA ES LA ÚNICA FUNCIÓN QUE ACTUALIZA EL HEADER.
     ======================================================================== */

  function updateHeaderUI() {

    const loginTrigger = $('loginTrigger');

    const menuItemProfile = $('menuItemProfile');
    const menuItemLogin = $('menuItemLogin');
    const menuItemLogout = $('menuItemLogout');


    /* ----------------------------------------------------------------------
       Botón principal
       ---------------------------------------------------------------------- */

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


    /* ----------------------------------------------------------------------
       Elementos dentro del menú
       ---------------------------------------------------------------------- */

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


    /* ----------------------------------------------------------------------
       Avisar a otras partes del sitio
       ---------------------------------------------------------------------- */

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


  /* ========================================================================
     MENÚ
     ======================================================================== */

  function closeMenu() {

    const menu = $('menu');
    const menuToggle = $('menuToggle');
    const menuIndicator = $('menuIndicator');


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
     * Solo permitimos nuevamente el scroll
     * si ningún modal está abierto.
     */

    const authOpen =
      $('authOverlay')?.classList.contains('open');

    const reviewOpen =
      $('reviewOverlay')?.classList.contains('open');


    if (!authOpen && !reviewOpen) {

      document.body.classList.remove(
        'menu-open'
      );

    }

  }


  function initMenu() {

    const menu = $('menu');
    const menuToggle = $('menuToggle');
    const menuIndicator = $('menuIndicator');


    if (!menu || !menuToggle) return;


    menuToggle.addEventListener(
      'click',
      (e) => {

        e.stopPropagation();


        const isOpen =
          menu.classList.toggle('open');


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

      }
    );


    /*
     * Click fuera del menú.
     */

    document.addEventListener(
      'click',
      (e) => {

        if (
          menu.classList.contains('open') &&
          !menu.contains(e.target)
        ) {

          closeMenu();

        }

      }
    );


    /*
     * Escape.
     */

    document.addEventListener(
      'keydown',
      (e) => {

        if (
          e.key === 'Escape' &&
          menu.classList.contains('open')
        ) {

          closeMenu();

        }

      }
    );

  }


  /* ========================================================================
     MODAL DE AUTENTICACIÓN
     ======================================================================== */

  function showAuthError(message, success = false) {

    const errorElement = $('authError');

    if (!errorElement) return;


    errorElement.textContent = message;

    errorElement.classList.toggle(
      'success',
      success
    );

    errorElement.classList.add(
      'visible'
    );

  }


  function clearAuthError() {

    const errorElement = $('authError');

    if (!errorElement) return;


    errorElement.textContent = '';

    errorElement.classList.remove(
      'visible',
      'success'
    );

  }


  /* ========================================================================
     CAMBIAR ENTRE LOGIN Y REGISTRO
     ======================================================================== */

  function setAuthMode(mode = 'login') {

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

      heading.textContent =
        isLogin
          ? 'Iniciar sesión'
          : 'Crear cuenta';

    }


    const subheading =
      $('authSubheading');

    if (subheading) {

      subheading.textContent =
        isLogin
          ? 'Entra para seguir tus recomendaciones'
          : 'Únete para guardar tus preferencias';

    }


    /*
     * Enlace inferior.
     */

    const authSwitch =
      $('authSwitch');


    if (authSwitch) {

      if (isLogin) {

        authSwitch.innerHTML =
          '¿No tienes cuenta? ' +
          '<button type="button" id="switchToRegister">' +
          'Crear una' +
          '</button>';

      } else {

        authSwitch.innerHTML =
          '¿Ya tienes cuenta? ' +
          '<button type="button" id="switchToLogin">' +
          'Iniciar sesión' +
          '</button>';

      }


      const switchButton =
        authSwitch.querySelector('button');


      switchButton?.addEventListener(
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


  /* ========================================================================
     ABRIR MODAL
     ======================================================================== */

  function openAuth(
    mode = 'login',
    message = null
  ) {

    const authOverlay =
      $('authOverlay');


    if (!authOverlay) {

      console.warn(
        'El modal de autenticación todavía no está disponible.'
      );

      return;

    }


    /*
     * AQUÍ ESTÁ UNA DE LAS CORRECCIONES:
     *
     * openAuth('login')
     * openAuth('register')
     *
     * ahora realmente cambia el formulario.
     */

    setAuthMode(mode);


    clearAuthError();


    authOverlay.classList.add(
      'open'
    );


    document.body.classList.add(
      'menu-open'
    );


    if (message) {

      const subheading =
        $('authSubheading');


      if (subheading) {

        subheading.textContent =
          message;

      }

    }

  }


  /* ========================================================================
     CERRAR MODAL
     ======================================================================== */

  function closeAuth() {

    const authOverlay =
      $('authOverlay');


    if (!authOverlay) return;


    authOverlay.classList.remove(
      'open'
    );


    /*
     * No quitamos menu-open si otro modal
     * continúa abierto.
     */

    const reviewOpen =
      $('reviewOverlay')?.classList.contains('open');


    const menuOpen =
      $('menu')?.classList.contains('open');


    if (!reviewOpen && !menuOpen) {

      document.body.classList.remove(
        'menu-open'
      );

    }

  }


  /* ========================================================================
     EVENTOS DEL MODAL
     ======================================================================== */

  function initAuthEvents() {

    const authOverlay =
      $('authOverlay');


    if (!authOverlay) return;


    /* ----------------------------------------------------------------------
       Botón principal
       ---------------------------------------------------------------------- */

    $('loginTrigger')?.addEventListener(
      'click',
      (e) => {

        if (currentUser) {

          /*
           * Si ya está conectado,
           * simplemente permite ir a perfil.html.
           */

          return;

        }


        e.preventDefault();

        openAuth('login');

      }
    );


    /* ----------------------------------------------------------------------
       Login desde el menú
       ---------------------------------------------------------------------- */

    $('menuItemLogin')?.addEventListener(
      'click',
      (e) => {

        if (currentUser) return;


        e.preventDefault();

        closeMenu();

        openAuth('login');

      }
    );


    /* ----------------------------------------------------------------------
       Cerrar
       ---------------------------------------------------------------------- */

    $('authClose')?.addEventListener(
      'click',
      closeAuth
    );


    /* ----------------------------------------------------------------------
       Click fuera
       ---------------------------------------------------------------------- */

    authOverlay.addEventListener(
      'click',
      (e) => {

        if (e.target === authOverlay) {

          closeAuth();

        }

      }
    );


    /* ----------------------------------------------------------------------
       Escape
       ---------------------------------------------------------------------- */

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


    /* ----------------------------------------------------------------------
       Pestañas
       ---------------------------------------------------------------------- */

    $('tabLogin')?.addEventListener(
      'click',
      () => setAuthMode('login')
    );


    $('tabRegister')?.addEventListener(
      'click',
      () => setAuthMode('register')
    );


    /* ======================================================================
       GITHUB
       ====================================================================== */

    $('githubLogin')?.addEventListener(
      'click',
      async () => {

        clearAuthError();


        const {
          error
        } =
          await supabaseClient.auth.signInWithOAuth({

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


    /* ======================================================================
       LOGIN CON CORREO
       ====================================================================== */

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


        if (!email || !password) {

          showAuthError(
            'Completa todos los campos.'
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


    /* ======================================================================
       REGISTRO
       ====================================================================== */

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


        if (!email || !password || !confirm) {

          showAuthError(
            'Completa todos los campos.'
          );

          return;

        }


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
         * Si Supabase requiere confirmación
         * por correo, todavía no existe una sesión.
         */

        if (!data.session) {

          showAuthError(
            'Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.',
            true
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


  /* ========================================================================
     CERRAR SESIÓN
     ======================================================================== */

  async function doLogout(e) {

    e.preventDefault();


    try {

      const {
        error
      } =
        await supabaseClient.auth.signOut();


      if (error) {

        console.error(
          'Error cerrando sesión:',
          error
        );

      }

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


  /* ========================================================================
     INICIALIZAR UI
     
     SE EJECUTA UNA SOLA VEZ DESPUÉS DE QUE
     components.js TERMINE.
     ======================================================================== */

  function initUI() {

    if (!componentsReady) return;

    if (uiInitialized) return;


    uiInitialized = true;


    initMenu();

    initAuthEvents();

    updateHeaderUI();

  }


  /* ========================================================================
     SESIÓN INICIAL
     ======================================================================== */

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


  /* ========================================================================
     CAMBIOS DE SESIÓN DE SUPABASE
     ======================================================================== */

  supabaseClient.auth.onAuthStateChange(
    (_event, session) => {

      currentUser =
        session
          ? session.user
          : null;


      /*
       * CORRECCIÓN IMPORTANTE:
       *
       * No intentamos inicializar la interfaz
       * desde aquí.
       *
       * Si los componentes todavía no existen,
       * esperamos a components-ready.
       *
       * Si ya existen, solamente actualizamos
       * el header mediante updateHeaderUI().
       */

      if (uiInitialized) {

        updateHeaderUI();

      }


      /*
       * Si acaba de iniciar sesión,
       * cerramos el modal.
       */

      if (currentUser) {

        const authOverlay =
          $('authOverlay');


        if (authOverlay) {

          authOverlay.classList.remove(
            'open'
          );

        }

      }

    }
  );


  /* ========================================================================
     ESPERAR COMPONENTES
     ======================================================================== */

  document.addEventListener(
    'overclock:components-ready',
    async () => {

      componentsReady = true;


      /*
       * Primero obtenemos la sesión actual.
       */

      await initSession();


      /*
       * Después inicializamos el menú
       * y el sistema de autenticación.
       */

      initUI();

    },
    { once: true }
  );


  /* ========================================================================
     LOGOUT
     ======================================================================== */

  /*
   * Este evento se registra cuando initUI()
   * ya garantizó que header.html existe.
   */

  document.addEventListener(
    'overclock:components-ready',
    () => {

      $('menuItemLogout')?.addEventListener(
        'click',
        doLogout
      );

    },
    { once: true }
  );


  /* ========================================================================
     API PÚBLICA
     ======================================================================== */

  return {

    get currentUser() {

      return currentUser;

    },


    /*
     * Abrir modal desde otras páginas/scripts.
     *
     * Ejemplo:
     *
     * ocAuth.openAuth('login');
     * ocAuth.openAuth('register');
     */

    openAuth(mode = 'login', message = null) {

      openAuth(mode, message);

    },


    closeAuth() {

      closeAuth();

    },


    onChange(fn) {

      if (
        typeof fn === 'function'
      ) {

        listeners.push(fn);

        /*
         * Si ya conocemos el estado,
         * avisamos inmediatamente.
         */

        if (uiInitialized) {

          try {

            fn(currentUser);

          } catch (error) {

            console.error(
              'Error en listener de ocAuth:',
              error
            );

          }

        }

      }

    }

  };

})();


/* ==========================================================================
   EXPONER API
   ========================================================================== */

window.ocAuth = ocAuth;
