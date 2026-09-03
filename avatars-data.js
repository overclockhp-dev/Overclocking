// avatars-data.js — catálogo compartido de avatares de Overclock.
// Usado por perfil.html, foro.html y perfil-publico.html.
// Las imágenes/audio las sube el dueño del sitio en assets/profile/...

const AVATARS = [
  {
    id: 'neko1',
    title: '',
    gradient: 'linear-gradient(135deg, #2b2740 0%, #0a0a0c 65%)',
    freq: 587.33,
    image: 'assets/profile/avatars/neko1.jpg',
    banner: 'assets/profile/banners/neko1.gif',
    audio: 'assets/profile/audio/neko1.mp3'
  },
  {
    id: 'neko2',
    title: '',
    gradient: 'linear-gradient(135deg, #3a2c2c 0%, #0a0a0c 65%)',
    freq: 493.88,
    image: 'assets/profile/avatars/neko2.jpg',
    banner: 'assets/profile/banners/neko2.gif',
    audio: 'assets/profile/audio/neko2.mp3'
  },
  {
    id: 'neko3',
    title: '',
    gradient: 'linear-gradient(135deg, #26313a 0%, #0a0a0c 65%)',
    freq: 659.25,
    image: 'assets/profile/avatars/neko3.jpg',
    banner: 'assets/profile/banners/neko3.gif',
    audio: 'assets/profile/audio/neko3.mp3'
  },
  {
    id: 'neko4',
    title: '',
    gradient: 'linear-gradient(135deg, #33262f 0%, #0a0a0c 65%)',
    freq: 440.0,
    image: 'assets/profile/avatars/neko4.jpg',
    banner: 'assets/profile/banners/neko4.gif',
    audio: 'assets/profile/audio/neko4.mp3'
  },
  {
    id: 'neko5',
    title: '',
    gradient: 'linear-gradient(135deg, #3a3320 0%, #0a0a0c 65%)',
    freq: 523.25,
    image: 'assets/profile/avatars/neko5.jpg',
    banner: 'assets/profile/banners/neko5.gif',
    audio: 'assets/profile/audio/neko5.mp3'
  }
];

// Ayuda a resolver un avatar por id, con fallback seguro al primero.
function ocGetAvatar(id) {
  return AVATARS.find(a => a.id === id) || AVATARS[0];
}

// Placeholder circular con la inicial del nombre, para cuando la imagen no carga.
function ocPlaceholderAvatar(name) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88">
    <rect width="100%" height="100%" fill="#1a1a1e"/>
    <text x="50%" y="50%" font-family="Georgia,serif" font-size="34" fill="#E4293B" text-anchor="middle" dominant-baseline="central">${initial}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

if (typeof window !== 'undefined') {
  window.AVATARS = AVATARS;
  window.ocGetAvatar = ocGetAvatar;
  window.ocPlaceholderAvatar = ocPlaceholderAvatar;
}
