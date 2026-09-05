// foro.js — lógica del foro de Overclock
// Requiere: auth.js (window.ocAuth), components.js, avatars-data.js,
// y el SDK de supabase-js, cargados antes que este script.

const FORUM_FUNCTIONS_URL = "https://jhqjzxotxyxhvxdtuzxu.functions.supabase.co/create-post";
const FORUM_REPLIES_FUNCTIONS_URL = "https://jhqjzxotxyxhvxdtuzxu.functions.supabase.co/create-reply";
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
  if (window.supabase && window.supabase.from) return window.supabase;
  console.error("foro.js: no se encontró el cliente de Supabase. Ajusta getSupabaseClient().");
  return null;
}

function waitForSupabaseClient(maxAttempts = 30, intervalMs = 100) {
  return new Promise((resolve) => {
    let attempts = 0;
    (function tryGet() {
      const client = getSupabaseClient();
      if (client) return resolve(client);
      attempts++;
      if (attempts >= maxAttempts) return resolve(null);
      setTimeout(tryGet, intervalMs);
    })();
  });
}

let currentTag = "";
let selectedPostTag = "general";
let sb = null;

document.addEventListener("DOMContentLoaded", async () => {
  sb = await waitForSupabaseClient();
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

// ---------- Modal propio (reemplaza prompt()/confirm() nativos) ----------
function showSiteModal({ title, message, showTextarea = false, confirmLabel = "Aceptar", cancelLabel = "Cancelar", hideCancel = false }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("siteModalOverlay");
    const textarea = document.getElementById("siteModalTextarea");
    const cancelBtn = document.getElementById("siteModalCancel");

    document.getElementById("siteModalTitle").textContent = title || "";
    document.getElementById("siteModalMessage").textContent = message || "";
    document.getElementById("siteModalConfirm").textContent = confirmLabel;
    cancelBtn.textContent = cancelLabel;
    cancelBtn.style.display = hideCancel ? "none" : "";
    textarea.style.display = showTextarea ? "block" : "none";
    textarea.value = "";

    overlay.classList.add("open");
    if (showTextarea) setTimeout(() => textarea.focus(), 50);

    function cleanup(result) {
      overlay.classList.remove("open");
      document.getElementById("siteModalConfirm").onclick = null;
      cancelBtn.onclick = null;
      overlay.onclick = null;
      resolve(result);
    }

    document.getElementById("siteModalConfirm").onclick = () => cleanup(showTextarea ? (textarea.value.trim() || "") : true);
    cancelBtn.onclick = () => cleanup(null);
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(null); };
  });
}

// Aviso simple de una sola opción — reemplaza alert()
function showSiteAlert(message, title = "Aviso") {
  return showSiteModal({ title, message, confirmLabel: "Aceptar", hideCancel: true });
}

// ---------- Tiempo relativo ----------
function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "justo ahora";
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(dateStr).toLocaleDateString("es", { day: "numeric", month: "short" });
}

// ---------- Estrellas ----------
function starSvg(filled, size = 13) {
  const cls = filled ? "star-filled" : "star-empty";
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
}
function reputationStarsHtml(points) {
  const filled = Math.min(5, Math.floor((points || 0) / 5));
  let html = '<div class="post-stars">';
  for (let i = 0; i < 5; i++) html += starSvg(i < filled);
  html += "</div>";
  return html;
}

// ---------- Cargar y pintar el feed ----------
async function loadFeed() {
  const feed = document.getElementById("feed");
  feed.innerHTML = '<p class="empty-state">Cargando publicaciones…</p>';
  if (!sb) return;

  let query = sb
    .from("forum_posts")
    .select("*, profiles(*), forum_replies(*, profiles(*))")
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

  // Traer mis propias calificaciones para estos posts (si hay sesión)
  let myRatings = {};
  const currentUser = window.ocAuth && window.ocAuth.currentUser;
  if (currentUser) {
    const postIds = data.map((p) => p.id);
    const { data: ratingsData } = await sb
      .from("post_ratings")
      .select("post_id, stars")
      .eq("rater_id", currentUser.id)
      .in("post_id", postIds);
    (ratingsData || []).forEach((r) => { myRatings[r.post_id] = r.stars; });
  }

  feed.innerHTML = "";
  data.forEach((post) => feed.appendChild(renderPost(post, myRatings[post.id])));
}

function renderPost(post, myRating) {
  const profile = post.profiles || {};
  const displayName = profile.display_name || "Usuario";
  const username = profile.username || "usuario";
  const avatarMeta = window.ocGetAvatar ? window.ocGetAvatar(profile.avatar_id || "neko1") : null;
  const avatarSrc = avatarMeta ? avatarMeta.image : "";
  const avatarFallback = window.ocPlaceholderAvatar ? window.ocPlaceholderAvatar(displayName) : "";
  const currentUser = window.ocAuth && window.ocAuth.currentUser;
  const isOwnPost = currentUser && currentUser.id === post.author_id;
  const profileUrl = isOwnPost ? "perfil.html" : `perfil-publico.html?u=${encodeURIComponent(post.author_id)}`;

  const replies = (post.forum_replies || [])
    .filter((r) => r.status === "published" || (currentUser && r.author_id === currentUser.id))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const el = document.createElement("article");
  el.className = "post";

  el.innerHTML = `
    <div class="post-head">
      <a class="post-avatar-link" href="${profileUrl}">
        <img class="post-avatar" src="${avatarSrc}" alt="" onerror="this.onerror=null;this.src='${avatarFallback}'">
      </a>
      <div class="post-author-block">
        <div class="post-author-line">
          <a class="post-author-name" href="${profileUrl}">${escapeHtml(displayName)}</a>
          <a class="post-author-username" href="${profileUrl}">@${escapeHtml(username)}</a>
          <span class="post-time">· ${timeAgo(post.created_at)}</span>
        </div>
        ${reputationStarsHtml(profile.social_reputation_points)}
      </div>
    </div>

    <div class="post-body">
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

      <div class="post-footer">
        <span class="post-tag">${TAG_LABELS[post.tag] ?? post.tag}</span>
        <div class="rate-widget" data-post-id="${post.id}">
          ${[1, 2, 3, 4, 5].map((n) => `
            <button type="button" class="rate-star${myRating && n <= myRating ? " filled" : ""}" data-value="${n}" ${isOwnPost ? "disabled title=\"No puedes calificar tu propia publicación\"" : "title=\"Calificar\""}>
              ${starSvg(!!(myRating && n <= myRating), 16)}
            </button>
          `).join("")}
        </div>
        <div class="post-actions-right">
          ${isOwnPost ? "" : '<button class="report-link">Reportar</button>'}
          ${isOwnPost ? '<button class="delete-link">Eliminar</button>' : ""}
        </div>
      </div>

      ${replies.length ? `<div class="replies-wrap">${replies.map((r) => renderReplyHtml(r)).join("")}</div>` : ""}

      <button type="button" class="reply-toggle" data-post-id="${post.id}">Responder</button>
      <div class="reply-composer" id="composer-${post.id}" hidden>
        <textarea placeholder="Escribe una respuesta..." maxlength="500"></textarea>
        <button type="button">Enviar</button>
      </div>
    </div>
  `;

  if (post.has_spoiler) {
    const contentEl = el.querySelector(".post-content");
    el.querySelector(".reveal-btn").addEventListener("click", () => {
      contentEl.textContent = post.content;
      contentEl.dataset.revealed = "true";
    });
    el.querySelector(".ignore-btn").addEventListener("click", () => {});
  }

  el.querySelector(".report-link").addEventListener("click", () => reportPost(post));
  const deleteBtn = el.querySelector(".delete-link");
  if (deleteBtn) deleteBtn.addEventListener("click", () => deletePost(post));

  if (!isOwnPost) {
    el.querySelectorAll(".rate-star").forEach((btn) => {
      btn.addEventListener("click", () => ratePost(post, parseInt(btn.dataset.value, 10)));
    });
  }

  // ---- hilo de respuestas ----
  const composerBox = el.querySelector(".reply-composer");
  el.querySelector(".reply-toggle").addEventListener("click", () => {
    composerBox.hidden = !composerBox.hidden;
    if (!composerBox.hidden) composerBox.querySelector("textarea").focus();
  });

  const composerTextarea = composerBox.querySelector("textarea");
  composerBox.querySelector("button").addEventListener("click", () => submitReply(post, composerTextarea));

  el.querySelectorAll(".reply-item").forEach((item) => {
    const replyId = item.dataset.replyId;
    const reply = replies.find((r) => r.id === replyId);
    const reportBtn = item.querySelector(".reply-report-btn");
    if (reportBtn) reportBtn.addEventListener("click", () => reportReply(reply));
    const delBtn = item.querySelector(".reply-delete-btn");
    if (delBtn) delBtn.addEventListener("click", () => deleteReply(reply));
  });

  return el;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderReplyHtml(reply) {
  const rp = reply.profiles || {};
  const displayName = rp.display_name || "Usuario";
  const username = rp.username || "usuario";
  const avatarMeta = window.ocGetAvatar ? window.ocGetAvatar(rp.avatar_id || "neko1") : null;
  const avatarSrc = avatarMeta ? avatarMeta.image : "";
  const avatarFallback = window.ocPlaceholderAvatar ? window.ocPlaceholderAvatar(displayName) : "";
  const currentUser = window.ocAuth && window.ocAuth.currentUser;
  const isOwn = currentUser && currentUser.id === reply.author_id;
  const profileUrl = isOwn ? "perfil.html" : `perfil-publico.html?u=${encodeURIComponent(reply.author_id)}`;

  return `
    <div class="reply-item" data-reply-id="${reply.id}">
      <a href="${profileUrl}"><img class="reply-avatar" src="${avatarSrc}" alt="" onerror="this.onerror=null;this.src='${avatarFallback}'"></a>
      <div class="reply-body">
        <div class="reply-head">
          <a class="reply-author" href="${profileUrl}">${escapeHtml(displayName)}</a>
          <a class="reply-username" href="${profileUrl}">@${escapeHtml(username)}</a>
          <span class="reply-time">· ${timeAgo(reply.created_at)}</span>
        </div>
        ${reply.status === "pending_review" && isOwn ? '<div class="composer-note">Tu respuesta quedó en revisión.</div>' : ""}
        <div class="reply-content ${reply.has_spoiler ? "spoiler" : ""}">
          ${reply.has_spoiler ? "Contiene spoilers." : escapeHtml(reply.content)}
        </div>
        <div class="reply-actions">
          ${isOwn ? "" : '<button class="reply-report-btn">Reportar</button>'}
          ${isOwn ? '<button class="reply-delete-btn">Eliminar</button>' : ""}
        </div>
      </div>
    </div>
  `;
}

// ---------- Calificar publicación ----------
async function ratePost(post, stars) {
  const currentUser = window.ocAuth && window.ocAuth.currentUser;
  if (!currentUser) {
    window.ocAuth?.openAuth?.("login", "Inicia sesión para calificar publicaciones.");
    return;
  }
  const { error } = await sb.from("post_ratings").upsert(
    { post_id: post.id, rater_id: currentUser.id, stars },
    { onConflict: "post_id,rater_id" }
  );
  if (error) {
    await showSiteAlert("No se pudo calificar: " + error.message);
    return;
  }
  loadFeed();
}

// ---------- Reportar publicación/usuario ----------
async function reportPost(post) {
  if (!window.ocAuth || !window.ocAuth.currentUser) {
    window.ocAuth?.openAuth?.("login", "Inicia sesión para reportar publicaciones.");
    return;
  }
  const reason = await showSiteModal({
    title: "Reportar publicación",
    message: "¿Por qué reportas esta publicación? (opcional)",
    showTextarea: true,
    confirmLabel: "Reportar",
  });
  if (reason === null) return;

  const { error } = await sb.from("forum_reports").insert({
    reporter_id: window.ocAuth.currentUser.id,
    reported_user_id: post.author_id,
    post_id: post.id,
    reason: reason || null,
  });

  if (error) {
    let msg = "No se pudo enviar el reporte.";
    if (error.message.includes("últimas 24 horas")) msg = "Ya reportaste a este usuario en las últimas 24 horas.";
    else if (error.message.includes("no_self_report")) msg = "No puedes reportar tu propia publicación.";
    await showSiteAlert(msg);
    return;
  }
  await showSiteAlert("Reporte enviado. Gracias por ayudar a mantener la comunidad.");
}

// ---------- Eliminar publicación propia ----------
async function deletePost(post) {
  const confirmed = await showSiteModal({
    title: "¿Eliminar publicación?",
    message: "Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
  });
  if (!confirmed) return;

  const { error } = await sb.from("forum_posts").delete().eq("id", post.id);
  if (error) {
    await showSiteAlert("No se pudo eliminar: " + error.message);
    return;
  }
  loadFeed();
}

// ---------- Responder a una publicación ----------
async function submitReply(post, textarea) {
  if (!window.ocAuth || !window.ocAuth.currentUser) {
    window.ocAuth?.openAuth?.("login", "Inicia sesión para responder.");
    return;
  }
  const content = textarea.value.trim();
  if (!content) return;

  const btn = textarea.nextElementSibling;
  btn.disabled = true;

  try {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("Tu sesión expiró, vuelve a iniciar sesión.");

    const res = await fetch(FORUM_REPLIES_FUNCTIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ post_id: post.id, content, has_spoiler: false }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "No se pudo responder.");

    textarea.value = "";
    loadFeed();
  } catch (err) {
    await showSiteAlert(err.message);
  } finally {
    btn.disabled = false;
  }
}

// ---------- Reportar / eliminar una respuesta ----------
async function reportReply(reply) {
  if (!window.ocAuth || !window.ocAuth.currentUser) {
    window.ocAuth?.openAuth?.("login", "Inicia sesión para reportar.");
    return;
  }
  const reason = await showSiteModal({
    title: "Reportar respuesta",
    message: "¿Por qué reportas esta respuesta? (opcional)",
    showTextarea: true,
    confirmLabel: "Reportar",
  });
  if (reason === null) return;

  const { error } = await sb.from("forum_reports").insert({
    reporter_id: window.ocAuth.currentUser.id,
    reported_user_id: reply.author_id,
    post_id: reply.post_id,
    reason: reason || null,
  });

  if (error) {
    let msg = "No se pudo enviar el reporte.";
    if (error.message.includes("últimas 24 horas")) msg = "Ya reportaste a este usuario en las últimas 24 horas.";
    else if (error.message.includes("no_self_report")) msg = "No puedes reportar tu propia publicación.";
    await showSiteAlert(msg);
    return;
  }
  await showSiteAlert("Reporte enviado. Gracias por ayudar a mantener la comunidad.");
}

async function deleteReply(reply) {
  const confirmed = await showSiteModal({
    title: "¿Eliminar respuesta?",
    message: "Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
  });
  if (!confirmed) return;

  const { error } = await sb.from("forum_replies").delete().eq("id", reply.id);
  if (error) {
    await showSiteAlert("No se pudo eliminar: " + error.message);
    return;
  }
  loadFeed();
}

// ---------- Compositor: publicar ----------
function setupComposer() {
  const imageInput = document.getElementById("postImage");
  const imagePreview = document.getElementById("imagePreview");
  const removeImageBtn = document.getElementById("removeImageBtn");

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      imagePreview.style.display = "block";
      removeImageBtn.style.display = "block";
    };
    reader.readAsDataURL(file);
  });

  removeImageBtn.addEventListener("click", () => {
    imageInput.value = "";
    imagePreview.src = "";
    imagePreview.style.display = "none";
    removeImageBtn.style.display = "none";
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
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${window.ocAuth.currentUser.id}/${Date.now()}-${safeName}`;
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
      document.getElementById("removeImageBtn").style.display = "none";
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

