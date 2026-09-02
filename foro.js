// foro.js — lógica del foro de Overclock
// Requiere que auth.js ya haya corrido antes (expone window.ocAuth) y que el
// SDK de supabase-js esté cargado antes de este script.

const FORUM_FUNCTIONS_URL = "https://jhqjzxotxyxhvxdtuzxu.functions.supabase.co/create-post";
const FORUM_IMAGES_BUCKET = "forum-images";

const TAG_LABELS = {
  general: "General",
  debate: "Abrir Debate",
  teoria: "Teoría",
  arte: "Mi arte",
  pregunta: "Pregunta",
  ayuda: "Ayuda",
};

// ---------- Resolver el cliente de Supabase ya creado por auth.js ----------
// AJUSTA esta función si tu auth.js expone el cliente con otro nombre.
function getSupabaseClient() {
  if (window.ocAuth && window.ocAuth.supabase && window.ocAuth.supabase.from) return window.ocAuth.supabase;
  if (window.ocAuth && window.ocAuth.client && window.ocAuth.client.from) return window.ocAuth.client;
  if (window.supabaseClient && window.supabaseClient.from) return window.supabaseClient;
  if (window.supabase && window.supabase.from) return window.supabase; // ya fue sobrescrito con la instancia
  console.error("foro.js: no se encontró el cliente de Supabase. Revisa cómo lo expone auth.js y ajusta getSupabaseClient().");
  return null;
}

let currentTag = "";
let selectedPostTag = "general"; // valor elegido en el dropdown propio del compositor
let sb = null;

document.addEventListener("DOMContentLoaded", () => {
  sb = getSupabaseClient();
  setupTagBar();
  setupTagDropdown();
  setupComposer();
  loadFeed();
});

// ---------- Dropdown propio de etiqueta en el compositor ----------
function setupTagDropdown() {
  const trigger = document.getElementById("tagDropdownTrigger");
  const menu = document.getElementById("tagDropdownMenu");
  const label = document.getElementById("tagDropdownLabel");

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !menu.hidden;
    menu.hidden = isOpen;
    trigger.classList.toggle("open", !isOpen);
  });

  menu.querySelectorAll("li").forEach((item) => {
    item.addEventListener("click", () => {
      selectedPostTag = item.dataset.value;
      label.textContent = item.textContent;
      menu.querySelectorAll("li").forEach((li) => li.classList.remove("active"));
      item.classList.add("active");
      menu.hidden = true;
      trigger.classList.remove("open");
    });
  });

  document.addEventListener("click", () => {
    menu.hidden = true;
    trigger.classList.remove("open");
  });
}

// ---------- Filtro de etiquetas ----------
function setupTagBar() {
  document.querySelectorAll("#tagBar .tag-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#tagBar .tag-chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTag = btn.dataset.tag;
      loadFeed();
    });
  });
}

// ---------- Cargar y pintar el feed ----------
async function loadFeed() {
  const feed = document.getElementById("feed");
  feed.innerHTML = '<p class="empty-state">Cargando publicaciones…</p>';
  if (!sb) return;

  let query = sb
    .from("forum_posts")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);

  if (currentTag) query = query.eq("tag", currentTag);

  const { data, error } = await query;

  if (error) {
    feed.innerHTML = `<p class="empty-state">No se pudo cargar el foro. ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    feed.innerHTML = '<p class="empty-state">Todavía no hay publicaciones con esta etiqueta. Sé el primero.</p>';
    return;
  }

  feed.innerHTML = "";
  data.forEach((post) => feed.appendChild(renderPost(post)));
}

function renderPost(post) {
  const el = document.createElement("article");
  el.className = "post";

  const date = new Date(post.created_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });

  el.innerHTML = `
    <div class="post-meta">
      <span class="post-tag">${TAG_LABELS[post.tag] ?? post.tag}</span>
      <span>·</span>
      <span>${date}</span>
    </div>
    ${post.has_spoiler ? '<div class="spoiler-banner">⚠ Alerta de spoilers</div>' : ""}
    <div class="post-content ${post.has_spoiler ? "spoiler" : ""}" data-revealed="${post.has_spoiler ? "false" : "true"}">
      ${post.has_spoiler ? "Este mensaje contiene spoilers." : escapeHtml(post.content)}
    </div>
    ${post.has_spoiler ? `
      <div class="spoiler-actions">
        <button class="ignore-btn">Ignorar</button>
        <button class="reveal-btn">Ver spoilers</button>
      </div>` : ""}
    ${post.image_url && post.image_status !== "flagged_nsfw" ? `<img class="post-image" src="${post.image_url}" alt="Imagen de la publicación">` : ""}
    <div class="post-actions">
      <button class="report-link">Reportar</button>
    </div>
  `;

  if (post.has_spoiler) {
    const contentEl = el.querySelector(".post-content");
    el.querySelector(".reveal-btn").addEventListener("click", () => {
      contentEl.textContent = post.content;
      contentEl.dataset.revealed = "true";
    });
    el.querySelector(".ignore-btn").addEventListener("click", () => {
      // se queda oculto, no hace nada más
    });
  }

  el.querySelector(".report-link").addEventListener("click", () => reportPost(post));

  return el;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Reportar publicación/usuario ----------
async function reportPost(post) {
  if (!window.ocAuth || !window.ocAuth.currentUser) {
    window.ocAuth?.openAuth?.("login", "Inicia sesión para reportar publicaciones.");
    return;
  }
  const reason = prompt("¿Por qué reportas esta publicación? (opcional)");
  if (reason === null) return; // canceló

  const { error } = await sb.from("forum_reports").insert({
    reporter_id: window.ocAuth.currentUser.id,
    reported_user_id: post.author_id,
    post_id: post.id,
    reason: reason || null,
  });

  if (error) {
    alert(error.message.includes("últimas 24 horas")
      ? "Ya reportaste a este usuario en las últimas 24 horas."
      : "No se pudo enviar el reporte.");
    return;
  }
  alert("Reporte enviado. Gracias por ayudar a mantener la comunidad.");
}

// ---------- Compositor: publicar ----------
function setupComposer() {
  const imageInput = document.getElementById("postImage");
  const imagePreview = document.getElementById("imagePreview");

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      imagePreview.style.display = "block";
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("publishBtn").addEventListener("click", publishPost);
}

async function publishPost() {
  if (!window.ocAuth || !window.ocAuth.currentUser) {
    window.ocAuth?.openAuth?.("login", "Inicia sesión para publicar en el foro.");
    return;
  }

  const btn = document.getElementById("publishBtn");
  const note = document.getElementById("composerNote");
  const content = document.getElementById("postContent").value.trim();
  const tag = selectedPostTag;
  const hasSpoiler = document.getElementById("postSpoiler").checked;
  const imageFile = document.getElementById("postImage").files[0];

  if (!content) {
    note.textContent = "Escribe algo antes de publicar.";
    return;
  }

  btn.disabled = true;
  note.textContent = "Publicando…";

  try {
    let imageUrl = null;
    if (imageFile) {
      const path = `${window.ocAuth.currentUser.id}/${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await sb.storage.from(FORUM_IMAGES_BUCKET).upload(path, imageFile);
      if (uploadError) throw new Error("No se pudo subir la imagen: " + uploadError.message);
      const { data: pub } = sb.storage.from(FORUM_IMAGES_BUCKET).getPublicUrl(path);
      imageUrl = pub.publicUrl;
    }

    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("Tu sesión expiró, vuelve a iniciar sesión.");

    const res = await fetch(FORUM_FUNCTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content, tag, has_spoiler: hasSpoiler, image_url: imageUrl }),
    });
    const result = await res.json();

    if (!res.ok) throw new Error(result.error || "No se pudo publicar.");

    if (result.post.status === "pending_review") {
      note.textContent = "Tu publicación quedó en revisión antes de mostrarse públicamente.";
    } else {
      note.textContent = "";
      document.getElementById("postContent").value = "";
      document.getElementById("postImage").value = "";
      document.getElementById("imagePreview").style.display = "none";
      document.getElementById("postSpoiler").checked = false;
      selectedPostTag = "general";
      document.getElementById("tagDropdownLabel").textContent = "General";
      document.querySelectorAll("#tagDropdownMenu li").forEach((li) => li.classList.toggle("active", li.dataset.value === "general"));
      loadFeed();
    }
  } catch (err) {
    note.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}
