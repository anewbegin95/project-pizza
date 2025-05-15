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
        for (let d = 0; d < 7; d++, day++) { // Loop through 7 days (Sun-Sat)
            const cell = document.createElement('div'); // Create a cell for each day
            cell.className = 'calendar-cell';
            if (day > 0 && day <= daysInMonth) {
                // This is a valid day in the current month
                const date = new Date(year, month, day); // Create a Date for this cell
                cell.setAttribute('data-date', formatDateId(date)); // Set a unique ID for the cell
                cell.innerHTML = `<div class="calendar-date">${day}</div>`; // Show the day number
                cell.classList.add('active-day'); // Style as an active day
            } else {
                // This cell is a blank (before the 1st or after the last day)
                cell.classList.add('inactive-day'); // Style as an inactive day
            }
            row.appendChild(cell); // Add the cell to the row
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

    // Loop through each event loaded from the CSV
    events.forEach(event => {

        // Parse the event's start and end dates
        const start = event.start_datetime ? new Date(event.start_datetime) : null;
        const end = event.end_datetime ? new Date(event.end_datetime) : start;
        if (!start) return; // Skip if no valid start date

        // Only process events that appear in this month
        let current = new Date(start);
        let barStarted = false;
        while (current <= end) {
            if (current.getMonth() === month && current.getFullYear() === year) {

                // Find the cell for this date
                const cell = document.querySelector(`.calendar-cell[data-date="${formatDateId(current)}"]`);
                if (cell) {
                    if (!barStarted) {
                        // Create a badge for the event
                        const bar = document.createElement('div');
                        bar.className = 'calendar-event-badge';
                        bar.textContent = event.name; // Show the event name
                        bar.tabIndex = 0; // Make badge focusable for accessibility

                        // When clicked, open the event modal (function from events.js)
                        bar.addEventListener('click', () => openEventModal(event));
                        cell.appendChild(bar); // Add the badge to the cell
                        barStarted = true;
                    } else {
                        // Add a continuation bar in subsequent cells
                        const cont = document.createElement('div');
                        cont.className = 'calendar-event-bar-continue';
                        cell.appendChild(cont);
                    }
                }
            }
        current.setDate(current.getDate() + 1);
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