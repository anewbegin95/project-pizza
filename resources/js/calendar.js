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

/**
 * This function determines how many event bars are visible in the calendar grid
 */
function getMaxVisible() {
  return window.innerWidth <= 860 ? 2 : 4;
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

    // Reveal the calendar section after calendar is rendered
    const calendarSection = document.getElementById('calendar-section');
    if (calendarSection) {
        calendarSection.classList.remove('hidden');
        calendarSection.style.display = '';
    }
}

/**
 * Places event badges in the correct calendar grid cells for the given month/year.
 * Loops through all events and puts them on the right days (including multi-day events).
 * @param {number} month - The month (0-based).
 * @param {number} year - The year (4-digit).
 */
function placeEventsInGrid(month, year) {
  const rows = document.querySelectorAll('.calendar-row');

  // For each week, build a list of events that touch that week
  for (let week = 0; week < 6; week++) {
    const barLayer = rows[week].querySelector('.calendar-row-bar-layer');
    if (!barLayer) continue;

    // Find the first and last cell index for this week
    const weekStartCell = week * 7;
    const weekEndCell = weekStartCell + 6;

    // Gather all events that touch this week
    const eventsInWeek = events.map(event => {
      const start = event.start_datetime ? new Date(event.start_datetime) : null;
      const end = event.end_datetime ? new Date(event.end_datetime) : start;
      if (!start) return null;
      let eventStart = new Date(start);
      let eventEnd = new Date(end);

      // --- FIX: Only render events that overlap the current month ---
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      if (eventEnd < monthStart || eventStart > monthEnd) return null;

      // Clamp eventStart and eventEnd to the visible month
      if (eventStart < monthStart) eventStart = monthStart;
      if (eventEnd > monthEnd) eventEnd = monthEnd;
      const firstDayOfMonth = new Date(year, month, 1);
      const startDayOfWeek = firstDayOfMonth.getDay();
      const eventStartDay = eventStart.getDate();
      const eventEndDay = eventEnd.getDate();

      // Clamp cell indices to the visible grid (0 to 41)
      let startCellIndex = Math.max(0, startDayOfWeek + eventStartDay - 1);
      let endCellIndex = Math.min(41, startDayOfWeek + eventEndDay - 1);

      // If event touches this week
      if (endCellIndex < weekStartCell || startCellIndex > weekEndCell) return null;

      // For this week, what columns does it span?
      const weekStartCol = Math.max(0, startCellIndex - weekStartCell);
      const weekEndCol = Math.min(6, endCellIndex - weekStartCell);

      // Guard: skip if weekStartCol or weekEndCol is NaN
      if (isNaN(weekStartCol) || isNaN(weekEndCol)) return null;

      // Only render if span is valid
      if (weekStartCol > weekEndCol) return null;
      return {
        event,
        startCellIndex,
        endCellIndex,
        weekStartCol,
        weekEndCol,
        isMultiDay: (startCellIndex !== endCellIndex)
      };
    }).filter(Boolean);

    // Sort: multi-day events first, then single-day
    eventsInWeek.sort((a, b) => {
      if (a.isMultiDay && !b.isMultiDay) return -1;
      if (!a.isMultiDay && b.isMultiDay) return 1;
      
      // If both are same type, sort by startCellIndex
      return a.startCellIndex - b.startCellIndex;
    });

    const maxVisible = getMaxVisible();
    
    // Map: col (0-6) => array of {event, slot, ...}
    const eventsByDay = Array(7).fill(0).map(() => []);
    // Track slots: slots[col][slotIndex] = true if occupied
    const slots = Array(7).fill(0).map(() => []);
    // For each event, find the first available slot that is free for all days it spans
    eventsInWeek.forEach(({event, weekStartCol, weekEndCol, isMultiDay, startCellIndex, endCellIndex}) => {
      // Skip bars that would have an invalid span (prevents bleed-over)
      if (weekStartCol > weekEndCol) return;
      let slot = 0;
      outer: for (; slot < 20; slot++) { // 20 is arbitrary max
        for (let col = weekStartCol; col <= weekEndCol; col++) {
          if (slots[col][slot]) continue outer;
        }
        break;
      }
      // Mark all columns as occupied in this slot and track events per day
      for (let col = weekStartCol; col <= weekEndCol; col++) {
        slots[col][slot] = true;
        eventsByDay[col].push({ event, slot, weekStartCol, weekEndCol, isMultiDay, startCellIndex, endCellIndex });
      }
      // Only render the bar if this event is among the first maxVisible for every day it spans
      let shouldRender = false;
      for (let col = weekStartCol; col <= weekEndCol; col++) {
        if (eventsByDay[col].indexOf(eventsByDay[col].find(e => e.event === event && e.slot === slot)) < maxVisible) {
          shouldRender = true;
        } else {
          shouldRender = false;
          break;
        }
      }
      if (!shouldRender) return;
      // Render the bar
      const bar = document.createElement('div');
      bar.className = 'calendar-event-bar';
      const sanitizedStartDatetime = event.start_datetime.replace(/[:]/g, '-');
      const uniqueId = `${event.name.replace(/\s+/g, '-').toLowerCase()}-${sanitizedStartDatetime}`;
      bar.setAttribute('data-event-id', uniqueId);
      event._calendarUniqueId = uniqueId;

      function highlightAllSegments() {
        const eventId = bar.getAttribute('data-event-id');
        document.querySelectorAll(`.calendar-event-bar[data-event-id="${eventId}"]`).forEach(el =>
          el.classList.add('calendar-event-bar--active')
        );
      }
      function unhighlightAllSegments() {
        const eventId = bar.getAttribute('data-event-id');
        document.querySelectorAll(`.calendar-event-bar[data-event-id="${eventId}"]`).forEach(el =>
          el.classList.remove('calendar-event-bar--active')
        );
      }

      // Highlight on hover/focus/click
      bar.addEventListener('mouseenter', highlightAllSegments);
      bar.addEventListener('focus', highlightAllSegments);
      bar.addEventListener('mouseleave', unhighlightAllSegments);
      bar.addEventListener('blur', unhighlightAllSegments);

      bar.addEventListener('click', (e) => {
        // Remove highlight from all bars first
        document.querySelectorAll('.calendar-event-bar--active').forEach(el => el.classList.remove('.calendar-event-bar--active'));
        highlightAllSegments();
        e.stopPropagation();
        window.location.href = `event.html?id=${event.id}`;
      });

      // Show event name:
      // - For single-day events, always show the name
      // - For multi-day events, only show on first week and first slot
      if (!isMultiDay) {
        bar.textContent = event.name;
      } else if (
        (week === Math.floor(startCellIndex / 7) && weekStartCol === (startCellIndex % 7)) ||
        weekStartCol === 0
      ) {
        bar.textContent = event.name;
      }
      bar.tabIndex = 0;
      bar.style.position = 'absolute';
      const horizontalMargin = 2; // px
      bar.style.left = `calc(${weekStartCol} * 100% / 7 + ${horizontalMargin}px)`;
      bar.style.width = `calc(${(weekEndCol - weekStartCol + 1)} * 100% / 7 - ${horizontalMargin * 2}px)`;
      bar.style.top = `${slot * 28}px`;
      bar.style.height = '24px';
      bar.style.zIndex = 2;

      // Rounded corners only on start/end
      if (week === Math.floor(startCellIndex / 7) && week === Math.floor(endCellIndex / 7)) {
        bar.style.borderRadius = 'var(--space-xxs)';
      } else if (week === Math.floor(startCellIndex / 7)) {
        bar.style.borderRadius = 'var(--space-xxs) 0 0 var(--space-xxs)';
      } else if (week === Math.floor(endCellIndex / 7)) {
        bar.style.borderRadius = '0 var(--space-xxs) var(--space-xxs) 0';
      } else {
        bar.style.borderRadius = '0';
      }
      barLayer.appendChild(bar);
    });
    // After rendering bars, add '+N more' link if needed
    for (let col = 0; col < 7; col++) {
      // Debug: log the number of events for this day
      // console.log(`Week ${week}, Col ${col}: eventsByDay[col].length =`, eventsByDay[col].length);
      if (eventsByDay[col].length > maxVisible) {
        // Find the cell for this week and column
        // barLayer is first child, so cell is children[col + 1]
        const cell = rows[week].children[col + 1];
        if (!cell.querySelector('.calendar-more-link')) { // Prevent duplicate links
          // Remove debug background color for production
          cell.style.backgroundColor = '';
          const moreLink = document.createElement('div');
          moreLink.className = 'calendar-more-link calendar-more-link--absolute';
          moreLink.textContent = `+${eventsByDay[col].length - maxVisible} more`;
          moreLink.tabIndex = 0;
          moreLink.addEventListener('click', (e) => {
            e.stopPropagation();
            // Calculate the date for this cell
            const firstDayOfMonth = new Date(year, month, 1);
            const startDayOfWeek = firstDayOfMonth.getDay();
            const cellDay = week * 7 + col - startDayOfWeek + 1;
            const cellDate = new Date(year, month, cellDay);
            // Find all events (from global events array) that occur on this date
            const cellDateId = formatDateId(cellDate);
            const eventsForDay = events.filter(event => {
              // Parse event start/end
              const start = event.start_datetime ? new Date(event.start_datetime) : null;
              const end = event.end_datetime ? new Date(event.end_datetime) : start;
              if (!start) return false;
              // Clamp event end to event start if missing
              const eventStart = new Date(start);
              const eventEnd = end ? new Date(end) : eventStart;
              // Check if cellDate is between eventStart and eventEnd (inclusive, by day)
              const cellYMD = cellDateId;
              const startYMD = formatDateId(eventStart);
              const endYMD = formatDateId(eventEnd);
              return cellYMD >= startYMD && cellYMD <= endYMD;
            });
            openDayEventsModal(cellDate, eventsForDay);
          });
          cell.appendChild(moreLink);
        }
      }
    }
  }
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
                    .filter(e =>
                        String(e.master_display).toUpperCase() === 'TRUE' &&
                        String(e.calendar).toUpperCase() === 'TRUE'
                    );
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
        // Re-render calendar on window resize to update maxVisible
        window.addEventListener('resize', () => {
            renderCalendar(currentMonth, currentYear);
        });
    }
});