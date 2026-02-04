// partials-loader.js

// --- Load <head> content from partials/head.html ---

// Use fetch to get the contents of the head partial HTML file
fetch('partials/head.html')
  .then((response) => {
    // Check if the fetch was successful (status 200–299)
    if (!response.ok) {
      // If not, throw an error that will be caught below
      throw new Error(`Failed to load head.html: ${response.statusText}`);
    }

    // If successful, convert the response to text (HTML string)
    return response.text();
  })
  .then((headContent) => {
    // Insert the fetched head content at the end of the current <head> tag
    document.head.insertAdjacentHTML('beforeend', headContent);

    // Get the custom page title from the <html> tag’s data-title attribute
    const pageTitle = document.documentElement.getAttribute('data-title');
    const pageDescription = document.documentElement.getAttribute('data-description');

    // If a title was specified, create a <title> tag and set its content
    if (pageTitle) {
      const titleElement = document.createElement('title'); // create new <title> element
      titleElement.textContent = pageTitle; // set the text inside <title>
      document.head.appendChild(titleElement); // add <title> to the <head>

      // Ensure Open Graph title mirrors page title
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute('content', pageTitle);
    }

    // Optionally override Open Graph description if provided per-page
    if (pageDescription) {
      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute('content', pageDescription);
    }

    // Ensure og:url reflects the current page URL
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute('content', window.location.href);
  })
  .catch((error) => {
    // Catch and log any errors that happen during fetch or DOM update
    console.error(error);
  });


// --- Load header partial from partials/header.html ---

fetch('partials/header.html')
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load header.html: ${response.statusText}`);
    }
    console.log('Header loaded successfully'); // Debugging log
    return response.text();
  })
  .then((headerContent) => {
    // Insert the fetched header at the beginning of the <body>
    document.body.insertAdjacentHTML('afterbegin', headerContent);

    // Initialize header.js functionality after header.html is loaded
    initializeHeader();
  })
  .catch((error) => {
    console.error(error);
  });

// Function to initialize header.js functionality
function initializeHeader() {
  const menuToggle = document.querySelector('.menu-toggle');
  const collapsibleMenu = document.querySelector('.collapsible-menu');

  if (menuToggle && collapsibleMenu) {
    menuToggle.addEventListener('click', () => {
      collapsibleMenu.classList.toggle('open');
      menuToggle.textContent = collapsibleMenu.classList.contains('open') ? 'x' : '=';
    });
    console.log('Menu toggle initialized'); // Debugging log
  } else {
    console.error('Menu toggle or collapsible menu not found in the DOM.');
  }
}


// --- Load footer partial from partials/footer.html ---

document.addEventListener('DOMContentLoaded', function() {
  fetch('partials/footer.html')
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load footer.html: ${response.statusText}`);
      }
      return response.text();
    })
    .then((footerContent) => {
      const placeholder = document.getElementById('footer-placeholder');
      if (placeholder) {
        placeholder.innerHTML = footerContent;
      } else {
        console.warn('Footer placeholder element not found in the DOM.');
      }
    })
    .catch((error) => {
      console.error(error);
    });
});
