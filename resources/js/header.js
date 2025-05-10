document.addEventListener('DOMContentLoaded', () => {
    const checkHeaderLoaded = setInterval(() => {
      const menuToggle = document.querySelector('.menu-toggle');
      const collapsibleMenu = document.querySelector('.collapsible-menu');
  
      if (menuToggle && collapsibleMenu) {
        clearInterval(checkHeaderLoaded); // Stop checking once the header is loaded
  
        menuToggle.addEventListener('click', () => {
          collapsibleMenu.classList.toggle('open');
          menuToggle.textContent = collapsibleMenu.classList.contains('open') ? 'x' : '=';
        });
      }
    }, 100); // Check every 100ms
  });