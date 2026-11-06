const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: "Banco de avaliações ainda não configurado." }, 503);
  const { results } = await env.DB.prepare(
    "SELECT id, name, rating, message, created_at FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 30"
  ).all();
  return json({ reviews: results || [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.TURNSTILE_SECRET_KEY) {
    return json({ error: "O sistema de avaliações ainda está sendo configurado." }, 503);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

  // Campo invisível anti-spam: bots frequentemente o preenchem.
  if (typeof body.website === "string" && body.website.trim()) return json({ ok: true });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const rating = Number(body.rating);
  const token = typeof body.token === "string" ? body.token : "";

  if (name.length < 2 || name.length > 80) return json({ error: "Informe um nome entre 2 e 80 caracteres." }, 400);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Selecione uma nota de 1 a 5 estrelas." }, 400);
  if (message.length < 5 || message.length > 1000) return json({ error: "A avaliação deve ter entre 5 e 1.000 caracteres." }, 400);
  if (!token || token.length > 4096) return json({ error: "Conclua a verificação de segurança." }, 400);

  const verify = new FormData();
  verify.append("secret", env.TURNSTILE_SECRET_KEY);
  verify.append("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) verify.append("remoteip", ip);

  let verification;
  try {
    const check = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: verify
    });
    verification = await check.json();
  } catch {
    return json({ error: "Não foi possível validar o CAPTCHA. Tente novamente." }, 502);
  }

  if (!verification.success) return json({ error: "A verificação de segurança expirou ou falhou. Faça o CAPTCHA novamente." }, 403);

  await env.DB.prepare(
    "INSERT INTO reviews (name, rating, message, status) VALUES (?, ?, ?, 'pending')"
  ).bind(name, rating, message).run();

  return json({ ok: true, message: "Avaliação enviada para moderação." }, 201);
}
