// api/places/details.js — Vercel serverless function
// Proxies Google Places Details API to get opening_hours with open_now

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { place_id } = req.query;

  if (!place_id) {
    return res.status(400).json({ error: 'place_id is required' });
  }

  const apiKey = process.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const fields = 'opening_hours,rating,user_ratings_total,name,formatted_address';
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
