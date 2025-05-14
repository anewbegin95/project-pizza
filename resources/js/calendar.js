// Calendar logic for month-view

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=0&single=true&output=csv';

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let events = [];

// Utility: Format date for cell IDs
function formatDateId(date) {
  return date.toISOString().split('T')[0];
}

// Render calendar grid for a given month/year
function renderCalendar(month, year) {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = ''; // Clear previous grid

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  // Header: Month Year
  document.getElementById('calendar-month-year').textContent =
    firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Create grid: 6 rows x 7 days
  let day = 1 - startDayOfWeek;
  for (let week = 0; week < 6; week++) {
    const row = document.createElement('div');
    row.className = 'calendar-row';
    for (let d = 0; d < 7; d++, day++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-cell';
      if (day > 0 && day <= daysInMonth) {
        const date = new Date(year, month, day);
        cell.setAttribute('data-date', formatDateId(date));
        cell.innerHTML = `<div class="calendar-date">${day}</div>`;
        cell.classList.add('active-day');
      } else {
        cell.classList.add('inactive-day');
      }
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }

  // Place events in the correct day cells
  placeEventsInGrid(month, year);
}

// Place events in the calendar grid
function placeEventsInGrid(month, year) {
  events.forEach(event => {
    // Only display events for this month
    const start = event.start_datetime ? new Date(event.start_datetime) : null;
    const end = event.end_datetime ? new Date(event.end_datetime) : start;
    if (!start) return;

    // For multi-day events, loop through each day
    let current = new Date(start);
    while (current <= end) {
      if (current.getMonth() === month && current.getFullYear() === year) {
        const cell = document.querySelector(`.calendar-cell[data-date="${formatDateId(current)}"]`);
        if (cell) {
          const badge = document.createElement('div');
          badge.className = 'calendar-event-badge';
          badge.textContent = event.name;
          badge.tabIndex = 0;
          badge.addEventListener('click', () => openEventModal(event));
          cell.appendChild(badge);
        }
      }
      current.setDate(current.getDate() + 1);
    }
  });
}

// Navigation
document.addEventListener('DOMContentLoaded', () => {
  fetch(GOOGLE_SHEET_CSV_URL)
    .then(res => res.text())
    .then(csv => {
      events = parseCSV(csv)
        .filter(e => String(e.master_display).toUpperCase() !== 'FALSE');
      renderCalendar(currentMonth, currentYear);
    });

  document.getElementById('prev-month').onclick = () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar(currentMonth, currentYear);
  };
  document.getElementById('next-month').onclick = () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar(currentMonth, currentYear);
  };
});

// === EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', () => {
  fetch(GOOGLE_SHEET_CSV_URL)
    .then(res => res.text())
    .then(csv => {
      events = parseCSV(csv)
        .filter(e => String(e.master_display).toUpperCase() !== 'FALSE');
      console.log('Loaded events:', events); // <-- Add this line
      renderCalendar(currentMonth, currentYear);
    });
  // ...rest of code...
});