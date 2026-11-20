import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const ACCESS_COOKIE = "gi_site_access";
const ACCESS_MAX_AGE = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function hasValidAccessCookie(request: Request, secret: string): Promise<boolean> {
  return (async () => {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookie = cookieHeader.split(";").map((part) => part.trim())
      .find((part) => part.startsWith(`${ACCESS_COOKIE}=`));
    if (!cookie) return false;

    const value = cookie.slice(ACCESS_COOKIE.length + 1);
    const [timestampText, signatureText] = value.split(".");
    const timestamp = Number(timestampText);
    const signature = fromBase64Url(signatureText ?? "");
    const now = Math.floor(Date.now() / 1000);

    if (!Number.isInteger(timestamp) || !signature || timestamp > now + 60 || now - timestamp > ACCESS_MAX_AGE) {
      return false;
    }

    const expected = await hmac(secret, `${ACCESS_COOKIE}:${timestamp}`);
    return equalBytes(signature, expected);
  })();
}

function loginPage(message = ""): Response {
  const safeMessage = message
    ? '<p role="alert" style="color:#b42318;margin:0 0 16px">Senha incorreta. Tente novamente.</p>'
    : "";
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Acesso protegido | Geladeira Inteligente</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#effcf7;color:#102b23;font-family:Arial,sans-serif}
main{width:min(100%,420px);padding:36px;border:1px solid #d5eee4;border-radius:22px;background:white;box-shadow:0 18px 60px #174b3518}
h1{margin:0 0 10px;font-size:25px}p{color:#587068;line-height:1.5}
label{display:block;margin:22px 0 8px;font-weight:700}input{width:100%;padding:14px;border:1px solid #bfd8cd;border-radius:10px;font-size:16px}
button{width:100%;margin-top:16px;padding:14px;border:0;border-radius:10px;background:#119c70;color:white;font-size:16px;font-weight:700;cursor:pointer}
</style></head>
<body><main><h1>Geladeira Inteligente</h1><p>Digite a senha de acesso para continuar.</p>${safeMessage}
<form method="post" action="/__site-access" autocomplete="on">
<label for="password">Senha de acesso</label>
<input id="password" name="password" type="password" required autocomplete="current-password" autofocus>
<button type="submit">Entrar</button></form></main></body></html>`;
  return new Response(html, {
    status: message ? 401 : 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, private" },
  });
}

const siteAccessMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  const url = new URL(request.url);

  if (url.pathname === "/__site-access") {
    if (request.method !== "POST") return loginPage();

    const password = process.env.SITE_ACCESS_PASSWORD;
    const secret = process.env.SITE_ACCESS_SECRET;
    if (!password || !secret) {
      return new Response("A proteção do site não está configurada.", { status: 503 });
    }

    const form = await request.formData();
    const submitted = String(form.get("password") ?? "");
    const expected = await hmac(secret, `password:${password}`);
    const received = await hmac(secret, `password:${submitted}`);

    if (!equalBytes(received, expected)) return loginPage("invalid");

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = toBase64Url(await hmac(secret, `${ACCESS_COOKIE}:${timestamp}`));
    return new Response(null, {
      status: 303,
      headers: {
        location: "/",
        "set-cookie": `${ACCESS_COOKIE}=${timestamp}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ACCESS_MAX_AGE}`,
        "cache-control": "no-store",
      },
    });
  }

  if (process.env.NODE_ENV !== "production") return next();

  const password = process.env.SITE_ACCESS_PASSWORD;
  const secret = process.env.SITE_ACCESS_SECRET;
  if (!password || !secret) {
    return new Response("A proteção do site não está configurada.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  if (!(await hasValidAccessCookie(request, secret))) return loginPage();
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [siteAccessMiddleware, errorMiddleware, csrfMiddleware],
}));
