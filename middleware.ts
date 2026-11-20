const SESSION_COOKIE = "__Host-geladeira_gate";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const UNLOCK_PATH = "/_gate/unlock";

type ServerEnv = {
  SITE_ACCESS_PASSWORD?: string;
  SITE_ACCESS_SECRET?: string;
};

function serverEnv(): ServerEnv {
  return (
    globalThis as typeof globalThis & {
      process?: { env?: ServerEnv };
    }
  ).process?.env ?? {};
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function gatePage(returnTo: string, message = ""): Response {
  const safeReturnTo = htmlEscape(returnTo);
  const safeMessage = htmlEscape(message);
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Acesso protegido | Geladeira Inteligente</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f4f8f5; color: #17251e; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    main { width: min(100%, 420px); padding: 36px; border: 1px solid #dce8df; border-radius: 22px; background: white; box-shadow: 0 18px 55px rgba(24, 64, 42, .09); }
    .mark { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; background: #e4f4e9; color: #218653; font-size: 25px; }
    h1 { margin: 22px 0 8px; font-size: 25px; letter-spacing: -.6px; }
    p { color: #5e7065; line-height: 1.55; }
    label { display: block; margin: 24px 0 8px; font-size: 14px; font-weight: 650; }
    input { width: 100%; height: 48px; padding: 0 14px; border: 1px solid #cbd9cf; border-radius: 11px; font: inherit; outline-color: #218653; }
    button { width: 100%; height: 48px; margin-top: 16px; border: 0; border-radius: 11px; background: #218653; color: white; font: inherit; font-weight: 700; cursor: pointer; }
    .error { margin: 14px 0 0; color: #b42318; font-size: 14px; }
    .foot { margin-top: 22px; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">⌂</div>
    <h1>Geladeira Inteligente</h1>
    <p>Este site está protegido. Informe a senha de acesso para continuar.</p>
    <form method="post" action="${UNLOCK_PATH}">
      <input type="hidden" name="returnTo" value="${safeReturnTo}">
      <label for="site-password">Senha de acesso</label>
      <input id="site-password" name="password" type="password" required maxlength="1024" autocomplete="current-password" autofocus>
      <button type="submit">Entrar no site</button>
      ${safeMessage ? `<p class="error" role="alert">${safeMessage}</p>` : ""}
    </form>
    <p class="foot">A autorização fica salva neste navegador por 30 dias.</p>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: message ? 401 : 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function assinatura(expiraEm: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`geladeira-gate:v1:${expiraEm}`),
  );
  return base64Url(new Uint8Array(signature));
}

function compararConstante(a: string, b: string): boolean {
  let diferenca = a.length ^ b.length;
  const tamanho = Math.max(a.length, b.length);
  for (let i = 0; i < tamanho; i += 1) {
    diferenca |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diferenca === 0;
}

function lerCookie(request: Request, nome: string): string | undefined {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const parte of cookieHeader.split(";")) {
    const separador = parte.indexOf("=");
    if (separador < 0) continue;
    if (parte.slice(0, separador).trim() === nome) {
      return parte.slice(separador + 1).trim();
    }
  }
  return undefined;
}

async function sessaoValida(request: Request, secret: string): Promise<boolean> {
  const token = lerCookie(request, SESSION_COOKIE);
  if (!token) return false;

  const [expiraTexto, assinaturaRecebida, extra] = token.split(".");
  if (!expiraTexto || !assinaturaRecebida || extra !== undefined) return false;

  const expiraEm = Number(expiraTexto);
  const agora = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expiraEm) || expiraEm <= agora) return false;

  const assinaturaEsperada = await assinatura(expiraEm, secret);
  return compararConstante(assinaturaRecebida, assinaturaEsperada);
}

function destinoSeguro(valor: string | null, request: Request): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) {
    return "/";
  }
  try {
    const destino = new URL(valor, request.url);
    return destino.origin === new URL(request.url).origin
      ? destino.pathname + destino.search + destino.hash
      : "/";
  } catch {
    return "/";
  }
}

function respostaIndisponivel(): Response {
  return new Response("A proteção de acesso ainda não foi configurada no servidor.", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const config = {
  matcher: ["/((?!_vercel/.*).*)"],
};

export default async function middleware(request: Request): Promise<Response | undefined> {
  const { SITE_ACCESS_PASSWORD, SITE_ACCESS_SECRET } = serverEnv();

  // Fail closed: never expose the application if either secret is missing or weak.
  if (!SITE_ACCESS_PASSWORD || !SITE_ACCESS_SECRET || SITE_ACCESS_SECRET.length < 32) {
    return respostaIndisponivel();
  }

  const url = new URL(request.url);

  if (url.pathname === UNLOCK_PATH && request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) {
      return new Response("Origem não permitida.", {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const tamanho = Number(request.headers.get("content-length") ?? "0");
    if (tamanho > 8192) {
      return new Response("Solicitação muito grande.", { status: 413 });
    }

    const tipo = request.headers.get("content-type") ?? "";
    if (!tipo.toLowerCase().includes("application/x-www-form-urlencoded")) {
      return new Response("Formato de solicitação inválido.", { status: 415 });
    }

    const corpo = await request.text();
    if (corpo.length > 8192) {
      return new Response("Solicitação muito grande.", { status: 413 });
    }

    const form = new URLSearchParams(corpo);
    const senhaInformada = form.get("password") ?? "";
    const returnTo = destinoSeguro(form.get("returnTo"), request);

    const senhaEsperada = base64Url(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SITE_ACCESS_PASSWORD))),
    );
    const senhaRecebida = base64Url(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(senhaInformada))),
    );

    if (!senhaInformada || senhaInformada.length > 1024 || !compararConstante(senhaRecebida, senhaEsperada)) {
      return gatePage(returnTo, "Senha incorreta. Confira e tente novamente.");
    }

    const expiraEm = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const token = `${expiraEm}.${await assinatura(expiraEm, SITE_ACCESS_SECRET)}`;
    return new Response(null, {
      status: 303,
      headers: {
        Location: returnTo,
        "Set-Cookie": `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (await sessaoValida(request, SITE_ACCESS_SECRET)) {
    return undefined;
  }

  const returnTo = url.pathname + url.search;
  return gatePage(returnTo);
}
