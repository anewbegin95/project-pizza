// Sanity client config + fetch helper for front-end usage.
// Uses the public API/CDN. No token required for public datasets.

// Public config for read-only front-end queries.
// Keep these values in sync with sanity.config.ts.
window.SANITY_CONFIG = {
  // Sanity project ID from your Studio config
  projectId: '41kk82h2',
  // Dataset name where content lives
  dataset: 'production',
  // API version for predictable query behavior
  apiVersion: '2024-01-01',
  // Use CDN for faster responses (stale by seconds) on public content
  useCdn: true,
};

function getSanityBaseUrl() {
  // Build the base URL for GROQ queries to the Sanity API/CDN.
  const { projectId, dataset, apiVersion, useCdn } = window.SANITY_CONFIG;
  const host = useCdn ? 'apicdn.sanity.io' : 'api.sanity.io';
  return `https://${projectId}.${host}/v${apiVersion}/data/query/${dataset}`;
}

function encodeParamValue(value) {
  // GROQ params must be JSON-encoded (strings must be quoted).
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return JSON.stringify(value);
}

window.sanityFetch = async function sanityFetch(query, params = {}) {
  // Public fetch helper for GROQ queries.
  const url = new URL(getSanityBaseUrl());
  url.searchParams.set('query', query);
  // Force published-only content in public frontend requests.
  url.searchParams.set('perspective', 'published');

  // Append GROQ parameters (e.g. $id) as query string values.
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(`$${key}`, encodeParamValue(value));
  });

  // Execute the request and return the `result` array/object.
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sanity query failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.result;
};
