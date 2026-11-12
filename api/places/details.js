// api/places/details.js — Vercel serverless function
// Proxies Google Places Details API to get opening_hours with open_now.
// The API key stays on the server; the browser only ever calls this route.

import { getPlacesKey, rejectBadMethod, rejectForeignOrigin, isReasonableString } from './_shared.js';

export default async function handler(req, res) {
  if (rejectBadMethod(req, res) || rejectForeignOrigin(req, res)) return;

  const { place_id } = req.query;

  if (!isReasonableString(place_id, 300)) {
    return res.status(400).json({ error: 'place_id is required' });
  }

  const apiKey = getPlacesKey();
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const fields = 'opening_hours,rating,user_ratings_total,name,formatted_address,geometry';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=${fields}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(200).json({ status: data.status, result: null });
    }

    return res.status(200).json({
      status: 'OK',
      result: data.result
    });
  } catch (error) {
    console.error('Places Details error:', error);
    return res.status(500).json({ error: 'Failed to fetch place details' });
  }
}
