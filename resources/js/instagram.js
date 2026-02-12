// === CONSTANTS ===

/**
 * Fetch Instagram post URLs from Sanity featured posts and embed them as videos.
 */

// === UTILITY FUNCTIONS ===

/**
  * Extracts the Instagram Reel ID from a given URL.
 */

function fetchInstagramPosts() {
  sanityFetch(window.SANITY_QUERIES.FEATURED_POSTS)
    .then(results => {
      const urls = (results || [])
        .map(item => (item.embed_url || '').trim())
        .filter(Boolean);
      renderInstagramEmbeds(urls);
    })
    .catch(err => {
      document.getElementById('instagram-videos').innerHTML = '<p>Could not load Instagram posts.</p>';
      console.error('Failed to fetch Instagram posts:', err);
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
    // Extract post ID from URL (e.g., /p/ or /reel/)
    const match = url.match(/instagram\.com\/(?:p|reel)\/([^/]+)/);
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
