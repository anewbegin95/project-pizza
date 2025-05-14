// Calendar logic for month-view

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=0&single=true&output=csv';

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let events = [];

/**
 * Parses a CSV string into an array of event objects.
 * Handles multi-line fields and ensures proper formatting for fields like `short_desc` and `long_desc`.
 * @param {string} csvText - The raw CSV string.
 * @returns {Array<Object>} - Array of parsed event objects.
 */
function parseCSV(csvText) {
    const rows = csvText.trim().split('\n');
    const headers = rows[0].split(',').map(h => h.trim());
    const events = [];
    let currentRow = [];

    rows.slice(1).forEach(row => {
        currentRow.push(row);
        const combinedRow = currentRow.join('\n');
        const quoteCount = (combinedRow.match(/"/g) || []).length;

        if (quoteCount % 2 === 0) {
            const values = combinedRow.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim());
            const event = {};
            headers.forEach((header, i) => {
                event[header] = values[i]?.replace(/^"+|"+$/g, '') || '';
            });
            event['recurring'] = event['recurring'] || 'FALSE';
            event['display'] = event['display'] || 'TRUE';
            event['link'] = event['link'] || '';
            events.push(event);
            currentRow = [];
        }
    });

    return events;
}

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

/**
 * Opens the event modal and populates it with event details.
 * @param {Object} event - Event object containing event details.
 */
function openEventModal(event) {
    // Prevent modal access if display is FALSE
    if (event.display === 'FALSE') {
        return;
    }

    const modal = document.getElementById('eventModal');
    document.getElementById('modalTitle').textContent = event.name;
    document.getElementById('modalImage').src = event.img || 'resources/images/images/default-event-image.jpeg';
    document.getElementById('modalImage').alt = `${event.name} image`;
    document.getElementById('modalDateRange').textContent = formatEventDate(event.start_datetime, event.end_datetime, event.all_day, event.recurring);
    document.getElementById('modalLocation').textContent = event.location || 'TBD';
    document.getElementById('modalDescription').innerHTML = event.long_desc.replace(/\n/g, '<br>') || 'No description available.';

    // Handle the modal CTA button
    const modalLink = document.getElementById('modalLink');
    if (event.link && event.link.trim() !== '') {
        modalLink.href = event.link;
        modalLink.textContent = event.link_text || 'Learn More';
        modalLink.classList.remove('hidden');
    } else {
        modalLink.href = '#';
        modalLink.classList.add('hidden');
    }

    // Handle the ICS link
    const icsLink = document.getElementById('icsLink');
    if (icsLink) {
        icsLink.classList.remove('hidden'); // Show the ICS link
        icsLink.addEventListener('click', (e) => {
            e.preventDefault();
            downloadICS(event);
        });
    }

    modal.classList.remove('hidden');
}

// Navigation
document.addEventListener('DOMContentLoaded', () => {
  fetch(GOOGLE_SHEET_CSV_URL)
    .then(res => res.text())
    .then(csv => {
      events = parseCSV(csv);
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