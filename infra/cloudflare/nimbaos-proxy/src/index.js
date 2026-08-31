const ORIGIN = "https://win-sk69nvld6f0.tailc11887.ts.net";
const PUBLIC_HOST = "app.nimbaos.ru";
const PUBLIC_ORIGIN = `https://${PUBLIC_HOST}`;
const WORKER_ORIGIN = "https://nimbaos-proxy.yaros-05.workers.dev";
const STATIC_CACHE_VERSION = "2026-08-24-1";

function removeBodySpecificHeaders(headers) {
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");
}

function addStaticAssetHeaders(headers) {
  headers.set("access-control-allow-origin", PUBLIC_ORIGIN);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.append("vary", "Origin");
}

function getStaticCacheKey(url) {
  const cacheUrl = new URL(url.pathname + url.search, WORKER_ORIGIN);
  cacheUrl.searchParams.set("nimba-proxy-cache", STATIC_CACHE_VERSION);
  return new Request(cacheUrl.toString(), { method: "GET" });
}

function rewriteNextAssetUrls(body) {
  return body.replaceAll(
    "/_next/static/",
    `${WORKER_ORIGIN}/_next/static/`,
  );
}

export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url);
    const isNextStaticAsset = incomingUrl.pathname.startsWith("/_next/static/");
    const isWebpackRuntime =
      isNextStaticAsset &&
      /^\/_next\/static\/chunks\/webpack-[^/]+\.js$/.test(
        incomingUrl.pathname,
      );

    // The custom hostname currently stalls while sending larger response bodies.
    // Redirect immutable Next.js assets through the same Worker's technical
    // hostname, which reliably serves the complete files.
    if (incomingUrl.hostname === PUBLIC_HOST && isNextStaticAsset) {
      const assetUrl = new URL(
        incomingUrl.pathname + incomingUrl.search,
        WORKER_ORIGIN,
      );
      return Response.redirect(assetUrl.toString(), 307);
    }

    const staticCacheKey =
      isNextStaticAsset && request.method === "GET"
        ? getStaticCacheKey(incomingUrl)
        : null;

    if (staticCacheKey) {
      const cachedResponse = await caches.default.match(staticCacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, ORIGIN);

    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", PUBLIC_HOST);
    headers.set("x-forwarded-proto", "https");

    if (headers.get("origin") === PUBLIC_ORIGIN) {
      headers.set("origin", ORIGIN);
    }

    const originRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: "manual",
    });

    const response = await fetch(originRequest);
    const responseHeaders = new Headers(response.headers);
    const location = responseHeaders.get("location");
    if (location) {
      responseHeaders.set(
        "location",
        location.replace(ORIGIN, PUBLIC_ORIGIN),
      );
    }

    if (isNextStaticAsset) {
      addStaticAssetHeaders(responseHeaders);

      let responseBody;
      if (isWebpackRuntime) {
        const source = await response.text();
        responseBody = source.replace(
          /\.p="\/_next\/"/,
          `.p="${WORKER_ORIGIN}/_next/"`,
        );
        removeBodySpecificHeaders(responseHeaders);
      } else {
        // Detach immutable assets before storing them in the edge cache.
        responseBody = await response.arrayBuffer();
      }

      const staticResponse = new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

      if (staticCacheKey && response.ok) {
        await caches.default.put(staticCacheKey, staticResponse.clone());
      }

      return staticResponse;
    }

    const contentType = responseHeaders.get("content-type") || "";
    const isNextDocument =
      contentType.includes("text/html") ||
      contentType.includes("text/x-component");

    if (incomingUrl.hostname === PUBLIC_HOST && isNextDocument) {
      const rewrittenBody = rewriteNextAssetUrls(await response.text());
      removeBodySpecificHeaders(responseHeaders);
      responseHeaders.set("cache-control", "no-store");

      return new Response(rewrittenBody, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};
