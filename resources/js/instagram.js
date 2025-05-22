// === CONSTANTS ===

/**
 * Array of Instagram Reel URLs you want thumbnails for
 */
const reelUrls = [
  "https://www.instagram.com/reel/DI9lbdeSkdQ/?hl=en",
  "https://www.instagram.com/reel/DItr8LqMOLe/?hl=en",
  "https://www.instagram.com/reel/DG9dhdxMSdg/?hl=en",
  "https://www.instagram.com/reel/DF8FqXuOZQG/?hl=en"
];

/** 
 * Manually define thumbnails or fetch them dynamically (Instagram doesn't have a public API for this easily).
 * For simplicity, I use the image URL from your example.
 * You can automate fetching thumbnails by scraping oEmbed or using an API, but here they are hardcoded.
 */
const thumbnails = {
  "DI9lbdeSkdQ": "https://i.postimg.cc/qvgYVqLs/Screenshot-2025-05-21-at-8-28-20-PM.png",
  "DItr8LqMOLe": "https://i.postimg.cc/HW8v2n2R/Screenshot-2025-05-21-at-8-35-23-PM.png",
  "DG9dhdxMSdg": "https://i.postimg.cc/zfLTrbV1/Screenshot-2025-05-21-at-8-36-27-PM.png",
  "DF8FqXuOZQG": "https://i.postimg.cc/g01wVGmy/Screenshot-2025-05-21-at-8-46-17-PM.png"
};

// === UTILITY FUNCTIONS ===

/**
 * Extracts the Reel ID from a given Instagram URL.
 * @param {string} url - The Instagram Reel URL.
 * @returns {string|null} - The extracted Reel ID or null if not found.
 */
function getReelId(url) {
  const match = url.match(/\/reel\/([^\/]+)\//);
  return match ? match[1] : null;
}

/**
 * Creates a thumbnail element for the Instagram Reel.
 * @param {string} videoId - The ID of the Instagram Reel.
 * @param {string} videoUrl - The URL of the Instagram Reel.
 * @param {string} thumbnailUrl - The URL of the thumbnail image.
 * @returns {HTMLElement} - The thumbnail element.
 */
function createThumbnailElement(videoId, videoUrl, thumbnailUrl) {
  const container = document.createElement("div");
  container.className = "video-thumbnail";

  const link = document.createElement("a");
  link.href = videoUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = "Watch Instagram Reel";

  const img = document.createElement("img");
  img.src = thumbnailUrl;
  img.alt = "Instagram Reel thumbnail";
  img.style.cursor = "pointer";
  img.style.maxWidth = "100%";
  img.style.borderRadius = "8px";
  img.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";

  link.appendChild(img);
  container.appendChild(link);
  return container;
}

// === MAIN FUNCTIONALITY ===
/**
 * Initializes the Instagram thumbnails by creating and appending them to the container.
 * This function is called when the DOM is fully loaded.
 */
function initInstagramThumbnails() {
  const container = document.getElementById("instagram-videos");
  reelUrls.forEach(url => {
    const id = getReelId(url);
    if (id && thumbnails[id]) {
      const thumbnailEl = createThumbnailElement(id, `https://www.instagram.com/reel/${id}/embed/`, thumbnails[id]);
      container.appendChild(thumbnailEl);
    }
  });
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", initInstagramThumbnails);
