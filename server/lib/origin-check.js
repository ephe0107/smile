/* ==========================================================
   Cross-site request forgery guard.

   Session cookies are SameSite=Lax, which already blocks cross-site POSTs
   from carrying them. This is the second layer: any request that changes
   data must also prove it came from our own origin.

   Preferring Sec-Fetch-Site over Origin matters because the browser sets it
   and script cannot, whereas a non-browser client controls Origin entirely.
   ========================================================== */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isTrustedRequest(request, allowedOrigin) {
  if (!MUTATING_METHODS.has(request.method)) return true;

  const site = request.headers["sec-fetch-site"];

  if (site) {
    // "none" is a direct navigation (typed URL, bookmark); "same-origin" is
    // our own page. Anything else, including a sibling subdomain, is refused.
    return site === "same-origin" || site === "none";
  }

  const origin = request.headers.origin;

  if (origin) {
    return origin.replace(/\/$/, "") === allowedOrigin;
  }

  // No Sec-Fetch-Site and no Origin means a non-browser client such as curl.
  // Those do not carry a user's ambient cookies, so there is no session to
  // ride; the route's own authentication still applies.
  return true;
}

function originGuard(allowedOrigin) {
  return async function guard(request, reply) {
    if (isTrustedRequest(request, allowedOrigin)) return;

    request.log.warn(
      { method: request.method, url: request.url, site: request.headers["sec-fetch-site"] },
      "rejected cross-site request"
    );
    reply.code(403).send({ error: "Cross-site requests are not allowed." });
  };
}

module.exports = { isTrustedRequest, originGuard, MUTATING_METHODS };
