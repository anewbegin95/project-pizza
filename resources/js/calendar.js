// === CALENDAR LOGIC FOR MONTH-VIEW ===

// === STATE ===
// Track the current month and year being displayed in the calendar
let currentMonth = new Date().getMonth(); // 0 = January, 11 = December
let currentYear = new Date().getFullYear(); // Four-digit year, e.g., 2025
let events = []; // This will hold all event objects loaded from the CSV

// === UTILITY FUNCTIONS ===

/**
 * Formats a Date object as YYYY-MM-DD for use as a cell ID.
 * This helps us uniquely identify each day in the calendar grid.
 * @param {Date} date - The date to format.
 * @returns {string} - The formatted date string (e.g., '2025-05-14').
 */
function formatDateId(date) {
    // Convert the date to ISO string and take only the date part (before 'T')
    return date.toISOString().split('T')[0];
}

// === UI RENDERING FUNCTIONS ===

/**
 * Renders the calendar grid for a given month and year.
 * This function creates the visual calendar and fills it with day cells.
 * @param {number} month - The month (0-based, so 0 = January).
 * @param {number} year - The year (four digits, e.g., 2025).
 */
function renderCalendar(month, year) {
    // Get the grid container element from the DOM
    const grid = document.getElementById('calendar-grid');
    // Clear any previous calendar grid content
    grid.innerHTML = '';

    // Create Date objects for the first and last day of the month
    const firstDay = new Date(year, month, 1); // e.g., May 1, 2025
    const lastDay = new Date(year, month + 1, 0); // Last day of the month
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 6 = Saturday
    const daysInMonth = lastDay.getDate(); // Number of days in the month

    // Set the calendar header to show the current month and year
    document.getElementById('calendar-month-year').textContent =
        firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // The calendar grid is always 6 rows of 7 days (to cover all possible month layouts)
    // 'day' starts negative if the month doesn't start on Sunday, so we fill in blanks
    let day = 1 - startDayOfWeek; // May start negative if the month doesn't start on Sunday
    for (let week = 0; week < 6; week++) {
        const row = document.createElement('div'); // Create a row for each week
        row.className = 'calendar-row';
        // Add a bar layer for event bars spanning the week
        const barLayer = document.createElement('div');
        barLayer.className = 'calendar-row-bar-layer';
        row.appendChild(barLayer);
        for (let d = 0; d < 7; d++, day++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            cell.style.gridColumn = (d + 1);

            if (day > 0 && day <= daysInMonth) {
                // Valid day in the current month
                const date = new Date(year, month, day);
                cell.setAttribute('data-date', formatDateId(date));
                cell.innerHTML = `<div class="calendar-date">${day}</div>`;
                cell.classList.add('active-day');
            } else {
                // Blank cell (before 1st or after last day)
                cell.classList.add('inactive-day');
            }
            row.appendChild(cell);
        }
        grid.appendChild(row); // Add the row to the grid
    }

    // After building the grid, place event badges in the correct cells
    placeEventsInGrid(month, year);
}

/**
 * Places event badges in the correct calendar grid cells for the given month/year.
 * Loops through all events and puts them on the right days (including multi-day events).
 * @param {number} month - The month (0-based).
 * @param {number} year - The year (4-digit).
 */
function placeEventsInGrid(month, year) {
  // For each event, determine which rows/weeks it spans
  events.forEach(event => {
    const start = event.start_datetime ? new Date(event.start_datetime) : null;
    const end = event.end_datetime ? new Date(event.end_datetime) : start;
    if (!start) return;

    let eventStart = new Date(start);
    let eventEnd = new Date(end);
    if (eventStart.getMonth() < month || eventStart.getFullYear() < year) {
      eventStart = new Date(year, month, 1);
    }
    if (eventEnd.getMonth() > month || eventEnd.getFullYear() > year) {
      eventEnd = new Date(year, month + 1, 0);
    }
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const eventStartDay = eventStart.getDate();
    const eventEndDay = eventEnd.getDate();
    const startCellIndex = startDayOfWeek + eventStartDay - 1;
    const endCellIndex = startDayOfWeek + eventEndDay - 1;
    const startRow = Math.floor(startCellIndex / 7);
    const endRow = Math.floor(endCellIndex / 7);

    // For each week the event spans
    for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
      const row = document.querySelectorAll('.calendar-row')[rowIdx];
      if (!row) continue;
      const barLayer = row.querySelector('.calendar-row-bar-layer');
      if (!barLayer) continue;

      // Determine start and end column for this week
      let weekStartCol = 0;
      let weekEndCol = 6;
      if (rowIdx === startRow) weekStartCol = startCellIndex % 7;
      if (rowIdx === endRow) weekEndCol = endCellIndex % 7;
      const spanLength = weekEndCol - weekStartCol + 1;

      // Stack bars vertically: count how many bars already in this row
      const barIndex = barLayer.children.length;
      const bar = document.createElement('div');
      bar.className = 'calendar-event-bar';
      if (rowIdx === startRow) bar.textContent = event.name;
      bar.tabIndex = 0;
      bar.addEventListener('click', () => openEventModal(event));

      // Position and size the bar
      bar.style.position = 'absolute';
      bar.style.left = `calc(${weekStartCol} * 100% / 7)`;
      bar.style.width = `calc(${spanLength} * 100% / 7 - 4px)`;
      bar.style.top = `${barIndex * 28}px`;
      bar.style.height = '24px';
      bar.style.zIndex = 2;

      // Rounded corners only on start/end
      if (rowIdx === startRow && rowIdx === endRow) {
        bar.style.borderRadius = 'var(--space-xxs)';
      } else if (rowIdx === startRow) {
        bar.style.borderRadius = 'var(--space-xxs) 0 0 var(--space-xxs)';
      } else if (rowIdx === endRow) {
        bar.style.borderRadius = '0 var(--space-xxs) var(--space-xxs) 0';
      } else {
        bar.style.borderRadius = '0';
      }
      barLayer.appendChild(bar);
    }
  });
}

// === MAIN FUNCTIONALITY ===

// Wait for the page to finish loading before running the calendar logic
// This ensures all DOM elements are available

document.addEventListener('DOMContentLoaded', () => {
    // Only run on calendar.html (where #calendar-grid exists)
    if (document.getElementById('calendar-grid')) {
        // Fetch the event data from the Google Sheet CSV (URL is defined in events.js)
        fetch(GOOGLE_SHEET_CSV_URL)
            .then(res => res.text()) // Get the CSV as text
            .then(csv => {
                // Parse the CSV and filter out hidden events
                events = parseCSV(csv)
                    .filter(e => String(e.master_display).toUpperCase() !== 'FALSE');
                // Render the calendar for the current month and year
                renderCalendar(currentMonth, currentYear);
            });

        // Set up the previous month button
        document.getElementById('prev-month').onclick = () => {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11; // Wrap to December
                currentYear--;
            }
            renderCalendar(currentMonth, currentYear); // Re-render with new month
        };
        // Set up the next month button
        document.getElementById('next-month').onclick = () => {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0; // Wrap to January
                currentYear++;
            }
            renderCalendar(currentMonth, currentYear); // Re-render with new month
        };
    }
});