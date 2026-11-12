// api/places/_shared.js — helpers for the Google Places proxy routes.
// Vercel does not turn files that start with "_" into routes.

// Server-only key. Set GOOGLE_PLACES_API_KEY in Vercel (no VITE_ prefix:
// anything starting with VITE_ can end up in the public website code).
// The VITE_ fallback only keeps the site working until you rename the
// variable in Vercel; delete it once GOOGLE_PLACES_API_KEY is set.
export function getPlacesKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY || null;
}

// Only allow GET, and no cross-site use. The site calls these routes from
// its own pages, so it never needed the old "Access-Control-Allow-Origin: *"
// header, which let any other website use your Google quota.
export function rejectBadMethod(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return true;
  }
  return false;
}

// Reject requests whose Origin header says they came from another website.
// (Requests from your own pages either send your origin or none at all.)
export function rejectForeignOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    if (new URL(origin).host === host) return false;
  } catch {
    // fall through to reject
  }
  res.status(403).json({ error: 'Forbidden' });
  return true;
}

export function isReasonableString(value, maxLength) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

export function isNumberInRange(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}
