/* ==========================================================================
   OVERCLOCK — auth.js
   Módulo único de autenticación (Supabase). Se incluye en TODAS las páginas
   que tengan el header con #loginTrigger y el modal de auth (#authOverlay).
   Cambiar la lógica de login/registro/sesión aquí; nunca copiarla a mano
   en cada página — así evitamos que vuelvan a desincronizarse como pasó
   entre index.html y biblioteca.html.

   Requiere en el <head> o antes de este script:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

   Expone en window: supabaseClient, ocAuth (currentUser, on(), openAuth, closeAuth)
   ========================================================================== */

const SUPABASE_URL = 'https://jhqjzxotxyxhvxdtuzxu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KA9m4jldQbksI7WmTimR8Q_KNXHrevT';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ocAuth = (() => {
  let currentUser = null;
  const listeners = [];

  function $(id) { return document.getElementById(id); }

  /* ---- Header: menú desplegable (Guía, Perfil, Foro...) ---- */
  const menu = $('menu');
  const menuToggle = $('menuToggle');
  const menuIndicator = $('menuIndicator');
  if (menu && menuToggle) {
    menuToggle.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', isOpen);
      if (menuIndicator) menuIndicator.textContent = isOpen ? '︿' : '﹀';
      document.body.classList.toggle('menu-open', isOpen);
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && menu.classList.contains('open')) {
        menu.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        if (menuIndicator) menuIndicator.textContent = '﹀';
        document.body.classList.remove('menu-open');
      }
    });
  }

  /* ---- UI: refleja el estado de sesión en el header (soporta ambos
     esquemas de markup que hay hoy en el sitio: index.html usa
     menuItemProfile/menuItemLogin/menuItemLogout con clases visible/hidden;
     el resto de páginas usa menuPerfil/menuLogout con el atributo hidden). */
  function updateHeaderUI() {
    const loginTrigger = $('loginTrigger');
    if (loginTrigger) {
      if (currentUser) {
        loginTrigger.textContent = 'Perfil';
        loginTrigger.setAttribute('href', 'perfil.html');
      } else {
        loginTrigger.textContent = 'Iniciar sesión';
        loginTrigger.setAttribute('href', '#');
      }
    }

    const menuItemProfile = $('menuItemProfile');
    const menuItemLogin = $('menuItemLogin');
    const menuItemLogout = $('menuItemLogout');
    if (menuItemProfile || menuItemLogin || menuItemLogout) {
      menuItemProfile?.classList.toggle('visible', !!currentUser);
      menuItemLogin?.classList.toggle('hidden', !!currentUser);
      menuItemLogout?.classList.toggle('visible', !!currentUser);
    }

    const menuPerfil = $('menuPerfil');
    const menuLogout = $('menuLogout');
    if (menuPerfil) menuPerfil.hidden = !currentUser;
    if (menuLogout) menuLogout.hidden = !currentUser;

    listeners.forEach(fn => fn(currentUser));
  }

  /* ---- Modal de login/registro (opcional: solo si la página lo incluye) ---- */
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
  function openAuth(mode, message) {
    if (!authOverlay) return;
    clearAuthError();
    authOverlay.classList.add('open');
    document.body.classList.add('menu-open');
    setAuthMode(mode || 'login');
    if (message) $('authSubheading').textContent = message;
  }
  function closeAuth() {
    if (!authOverlay) return;
    authOverlay.classList.remove('open');
    document.body.classList.remove('menu-open');
  }
  function setAuthMode(mode) {
    const isLogin = mode === 'login';
    clearAuthError();
    $('tabLogin')?.classList.toggle('active', isLogin);
    $('tabRegister')?.classList.toggle('active', !isLogin);
    $('formLogin')?.classList.toggle('active', isLogin);
    $('formRegister')?.classList.toggle('active', !isLogin);
    if ($('authHeading')) $('authHeading').textContent = isLogin ? 'Iniciar sesión' : 'Crear cuenta';
    if ($('authSubheading')) $('authSubheading').textContent = isLogin
      ? 'Entra para seguir tus recomendaciones'
      : 'Únete para guardar tus preferencias';
    const authSwitch = $('authSwitch');
    if (authSwitch) {
      authSwitch.innerHTML = isLogin
        ? '¿No tienes cuenta? <button type="button" id="switchToRegister">Crear una</button>'
        : '¿Ya tienes cuenta? <button type="button" id="switchToLogin">Iniciar sesión</button>';
      authSwitch.querySelector('button').addEventListener('click', () =>
        setAuthMode(isLogin ? 'register' : 'login')
      );
    }
  }

  if (authOverlay) {
    $('loginTrigger')?.addEventListener('click', (e) => {
      if (currentUser) return; // ya logueado: deja que el link vaya a perfil.html
      e.preventDefault();
      openAuth('login');
    });
    $('menuItemLogin')?.addEventListener('click', (e) => {
      if (currentUser) return;
      e.preventDefault();
      openAuth('login');
    });
    $('authClose')?.addEventListener('click', closeAuth);
    authOverlay.addEventListener('click', (e) => {
      if (e.target === authOverlay) closeAuth();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && authOverlay.classList.contains('open')) closeAuth();
    });
    $('tabLogin')?.addEventListener('click', () => setAuthMode('login'));
    $('tabRegister')?.addEventListener('click', () => setAuthMode('register'));

    $('githubLogin')?.addEventListener('click', async () => {
      clearAuthError();
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.href.split('#')[0] }
      });
      if (error) showAuthError('No se pudo iniciar sesión con GitHub: ' + error.message);
    });

    $('formLogin')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthError();
      const email = $('loginEmail').value.trim();
      const password = $('loginPassword').value;
      const submitBtn = e.target.querySelector('.auth-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Entrando…';

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

      submitBtn.disabled = false;
      submitBtn.textContent = 'Iniciar sesión';

      if (error) {
        showAuthError(error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : error.message);
        return;
      }
      currentUser = data.user;
      updateHeaderUI();
      closeAuth();
    });

    $('formRegister')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthError();
      const email = $('registerEmail').value.trim();
      const password = $('registerPassword').value;
      const confirm = $('registerConfirm').value;

      if (password !== confirm) return showAuthError('Las contraseñas no coinciden.');
      if (password.length < 6) return showAuthError('La contraseña debe tener al menos 6 caracteres.');

      const submitBtn = e.target.querySelector('.auth-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creando cuenta…';

      const { data, error } = await supabaseClient.auth.signUp({ email, password });

      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear cuenta';

      if (error) return showAuthError(error.message);

      if (!data.session) {
        showAuthError('Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.');
        e.target.reset();
        return;
      }
      currentUser = data.user;
      updateHeaderUI();
      closeAuth();
    });
  }

  /* ---- Logout: soporta el botón con cualquiera de los dos ids ---- */
  async function doLogout(e) {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    currentUser = null;
    updateHeaderUI();
    menu?.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    if (menuIndicator) menuIndicator.textContent = '﹀';
    document.body.classList.remove('menu-open');
  }
  $('menuItemLogout')?.addEventListener('click', doLogout);
  $('menuLogout')?.addEventListener('click', doLogout);

  /* ---- Sincronización real de sesión (única fuente de verdad) ---- */
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session ? session.user : null;
    updateHeaderUI();
    if (currentUser) closeAuth();
  });

  (async function initSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session ? session.user : null;
    updateHeaderUI();
  })();

  return {
    get currentUser() { return currentUser; },
    openAuth,
    closeAuth,
    /* otras páginas pueden reaccionar al login/logout sin tocar este archivo */
    onChange(fn) { listeners.push(fn); }
  };
})();
