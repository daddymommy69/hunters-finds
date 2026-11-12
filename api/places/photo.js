// api/places/photo.js — Vercel serverless function
// Returns a Google Places photo without putting the API key in the page.
// Google answers the keyed photo URL with a redirect to a plain image URL
// (no key in it); we pass that redirect on to the browser.

import { getPlacesKey, rejectBadMethod, isReasonableString } from './_shared.js';

export default async function handler(req, res) {
  if (rejectBadMethod(req, res)) return;

  const { ref } = req.query;
  if (!isReasonableString(ref, 1000) || !/^[A-Za-z0-9_-]+$/.test(ref)) {
    return res.status(400).json({ error: 'ref is required' });
  }

  const apiKey = getPlacesKey();
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${encodeURIComponent(ref)}&key=${apiKey}`;
    const response = await fetch(url, { redirect: 'manual' });
    const location = response.headers.get('location');

    if (response.status >= 300 && response.status < 400 && location && !location.includes(apiKey)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Location', location);
      return res.status(302).end();
    }

    return res.status(404).json({ error: 'Photo not found' });
  } catch (error) {
    console.error('Places Photo error:', error);
    return res.status(500).json({ error: 'Failed to fetch photo' });
  }
}
