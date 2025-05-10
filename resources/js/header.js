document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const collapsibleMenu = document.querySelector('.collapsible-menu');

    menuToggle.addEventListener('click', () => {
        // Toggle the menu visibility
        collapsibleMenu.classList.toggle('open');
        // Change the menu toggle icon
        menuToggle.textContent = collapsibleMenu.classList.contains('open') ? 'x' : '=';
    });
});