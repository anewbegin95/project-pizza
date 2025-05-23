// === CONSTANTS ===

/**
 * Fetch Instagram post URLs from Google Sheets CSV and embed them as videos
 */

const INSTAGRAM_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=1211399873&single=true&output=csv';

// === UTILITY FUNCTIONS ===

/**
  * Extracts the Instagram Reel ID from a given URL.
 */

function fetchInstagramPosts() {
  fetch(INSTAGRAM_CSV_URL)
    .then(response => response.text())
    .then(csv => {
      // Split CSV into lines, skip header
      const lines = csv.trim().split('\n').slice(1);
      const urls = lines.map(line => line.replace(/"/g, '').trim()).filter(Boolean);
      renderInstagramEmbeds(urls);
    })
    .catch(err => {
      document.getElementById('instagram-videos').innerHTML = '<p>Could not load Instagram posts.</p>';
      console.error('Failed to fetch Instagram CSV:', err);
    });
}

/**
  * Renders Instagram embeds in a grid layout.
  * @param {Array} urls - Array of Instagram post URLs.
  * @returns {void}
 */
function renderInstagramEmbeds(urls) {
  const container = document.getElementById('instagram-videos');
  container.innerHTML = ''; // Clear any previous content

  const grid = document.createElement('div');
  grid.className = 'instagram-embed-grid';

  urls.forEach(url => {
    // Extract post ID from URL (e.g., https://www.instagram.com/p/POST_ID/)
    const match = url.match(/instagram\.com\/p\/([^/]+)/);
    if (match) {
      const postId = match[1];
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.instagram.com/p/${postId}/embed?hidecaption=true`;
      iframe.width = 320;
      iframe.height = 400;
      iframe.frameBorder = 0;
      iframe.scrolling = 'no';
      iframe.allowTransparency = true;
      iframe.style.background = 'var(--nyc-white, #fff)';
      iframe.style.borderRadius = 'var(--space-xs, 8px)';
      iframe.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
      grid.appendChild(iframe);
    }
  });

  container.appendChild(grid);
}

// Run on page load
fetchInstagramPosts();
