// api/places/search.js
// Vercel serverless function to proxy Google Places Text Search.
// The API key stays on the server; the browser only ever calls this route.

import { getPlacesKey, rejectBadMethod, rejectForeignOrigin, isReasonableString, isNumberInRange } from './_shared.js';

export default async function handler(req, res) {
  if (rejectBadMethod(req, res) || rejectForeignOrigin(req, res)) return;

  const { query, lat, lng, radius = 5000 } = req.query;

  if (!isReasonableString(query, 200)) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  const apiKey = getPlacesKey();
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const hasLocation = lat && lng && isNumberInRange(lat, -90, 90) && isNumberInRange(lng, -180, 180);
    const safeRadius = isNumberInRange(radius, 1, 50000) ? Number(radius) : 5000;
    const location = hasLocation ? `&location=${Number(lat)},${Number(lng)}&radius=${safeRadius}` : '';
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}${location}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Proxy request failed' });
  }
}
