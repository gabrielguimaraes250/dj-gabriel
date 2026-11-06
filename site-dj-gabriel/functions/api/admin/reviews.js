const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function authorized(request, expected) {
  const header = request.headers.get("Authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!supplied || !expected) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function onRequestGet({ request, env }) {
  if (!await authorized(request, env.ADMIN_PASSWORD)) return json({ error: "Acesso não autorizado." }, 401);
  if (!env.DB) return json({ error: "Banco de dados não configurado." }, 503);
  const { results } = await env.DB.prepare(
    "SELECT id, name, rating, message, status, created_at FROM reviews WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100"
  ).all();
  return json({ reviews: results || [] });
}

export async function onRequestPost({ request, env }) {
  if (!await authorized(request, env.ADMIN_PASSWORD)) return json({ error: "Acesso não autorizado." }, 401);
  if (!env.DB) return json({ error: "Banco de dados não configurado." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  const id = Number(body.id);
  const status = body.status;
  if (!Number.isInteger(id) || id < 1 || !["approved", "rejected"].includes(status)) {
    return json({ error: "Ação inválida." }, 400);
  }
  const result = await env.DB.prepare("UPDATE reviews SET status = ? WHERE id = ? AND status = 'pending'")
    .bind(status, id).run();
  if (!result.meta?.changes) return json({ error: "Avaliação não encontrada ou já moderada." }, 404);
  return json({ ok: true });
}
