// dates.js
// Fills elements marked with data-fill="month-year" with the current Month Year

(function() {
  function fillMonthYear() {
    var now = new Date();
    var formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
    var text = formatter.format(now);
    var nodes = document.querySelectorAll('[data-fill="month-year"]');
    nodes.forEach(function(el) { el.textContent = text; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillMonthYear);
  } else {
    fillMonthYear();
  }
})();
