// supabase/functions/create-post/index.ts
//
// Punto único de entrada para crear publicaciones del foro.
// El cliente (foro.js) NUNCA inserta directo en forum_posts — siempre pasa por aquí,
// así el filtro de censura y el chequeo de imagen +18 no se pueden saltar.
//
// Desplegar con:  supabase functions deploy create-post
// Variables de entorno necesarias en el proyecto (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (ya vienen por defecto)
//   NSFW_ENDPOINT_URL  → URL de tu servicio autoalojado de detección NSFW (ver nota abajo)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- Lista de palabras (EJEMPLO — reemplázala/amplíala tú) ----------
// Tres niveles de gravedad. Se recomienda mantener esta lista fuera del
// repo público (como secreto/tabla) una vez que la amplíes de verdad.
const WORD_LISTS: Record<string, string[]> = {
  leve: ["idiota", "estupido", "tonto"],
  grave: ["imbecil"], // ejemplo — amplía con tu propia lista real
  bloqueo: [],         // acoso / amenaza / discriminación → agrega aquí, bloquea siempre
};

// ---------- Normalización anti-leetspeak / anti-espaciado ----------
function normalize(text: string): string {
  let t = text.toLowerCase();
  t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quita acentos
  // colapsa espacios/símbolos intercalados entre letras: "i.d i o t a" -> "idiota"
  t = t.replace(/[\s\.\-_\*]+/g, "");
  // mapeo leetspeak común
  const leet: Record<string, string> = {
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s",
  };
  t = t.split("").map((c) => leet[c] ?? c).join("");
  return t;
}

function classifyText(rawText: string) {
  const normalized = normalize(rawText);
  let severity: "ok" | "leve" | "grave" | "bloqueo" = "ok";
  let censored = rawText;

  for (const word of WORD_LISTS.bloqueo) {
    if (normalized.includes(normalize(word))) severity = "bloqueo";
  }
  if (severity === "ok") {
    for (const word of WORD_LISTS.grave) {
      if (normalized.includes(normalize(word))) severity = "grave";
    }
  }
  if (severity === "ok") {
    for (const word of WORD_LISTS.leve) {
      if (normalized.includes(normalize(word))) {
        severity = "leve";
        const re = new RegExp(word.split("").join("[\\s\\.\\-_\\*]*"), "gi");
        censored = censored.replace(re, (m) => m[0] + "*".repeat(Math.max(m.length - 1, 1)));
      }
    }
  }

  return { normalized, severity, censored };
}

// ---------- Chequeo de imagen NSFW (servicio autoalojado) ----------
// Monta tu propio servicio (ej. un Space de Hugging Face corriendo NSFWJS /
// Falconsai/nsfw_image_detection) y expón un endpoint POST que reciba
// { image_url } y responda { nsfw_score: 0..1 }. Pon esa URL en NSFW_ENDPOINT_URL.
async function checkImageNSFW(imageUrl: string): Promise<{ flagged: boolean }> {
  const endpoint = Deno.env.get("NSFW_ENDPOINT_URL");
  if (!endpoint) {
    // Sin endpoint configurado todavía: la imagen queda pendiente de revisión manual
    // en vez de publicarse sin chequear.
    return { flagged: true };
  }
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl }),
    });
    const data = await res.json();
    return { flagged: (data.nsfw_score ?? 1) > 0.6 };
  } catch {
    // Si el servicio autoalojado falla o está "dormido", no publicamos sin revisar.
    return { flagged: true };
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Cliente con la sesión del usuario, solo para verificar quién es
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401 });
  }
  const userId = userData.user.id;

  const body = await req.json();
  const { content, tag, has_spoiler, image_url } = body;

  const validTags = ["general", "debate", "teoria", "arte", "pregunta", "ayuda"];
  if (!content || !validTags.includes(tag)) {
    return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400 });
  }

  const { normalized, severity, censored } = classifyText(content);

  if (severity === "bloqueo" || severity === "grave") {
    // No se publica: queda pendiente de revisión humana.
    var finalContent = content;
    var postStatus = "pending_review";
  } else {
    // "leve" se autopublica censurado; "ok" se publica tal cual.
    var finalContent = severity === "leve" ? censored : content;
    var postStatus = "published";
  }

  let imageStatus = "none";
  if (image_url) {
    const { flagged } = await checkImageNSFW(image_url);
    imageStatus = flagged ? "flagged_nsfw" : "approved";
    if (flagged && postStatus === "published") postStatus = "pending_review";
  }

  // Cliente con service_role: bypassa RLS, es el único punto que puede insertar
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await adminClient
    .from("forum_posts")
    .insert({
      author_id: userId,
      content: finalContent,
      tag,
      has_spoiler: !!has_spoiler,
      image_url: image_url ?? null,
      image_status: imageStatus,
      status: postStatus,
      normalized_content: normalized,
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ post: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
