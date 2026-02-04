
// === CALENDAR LOGIC FOR MONTH-VIEW ===

// === CONSTANTS ===
/**
 * Magic numbers and style values used in calendar rendering.
 * If you update the CSS, update these to match.
 */
const MAX_EVENT_BAR_SLOTS = 20; // Max vertical slots for pop-up bars per week
const EVENT_BAR_HEIGHT_PX = 24; // px, matches CSS
const EVENT_BAR_VERTICAL_SPACING_PX = 28; // px, matches CSS
const EVENT_BAR_HORIZONTAL_MARGIN_PX = 2; // px, matches CSS

// === STATE ===
// Track the current month and year being displayed in the calendar
let currentMonth = new Date().getMonth(); // 0 = January, 11 = December
let currentYear = new Date().getFullYear(); // Four-digit year, e.g., 2025
let popups = []; // This will hold all pop-up objects loaded from the CSV

// === UTILITY FUNCTIONS ===
/**
 * Highlights all segments of a multi-day pop-up bar.
 * @param {string} popupId
 */
function highlightAllSegments(popupId) {
  document.querySelectorAll(`.calendar-popup-bar[data-event-id="${popupId}"]`).forEach(el =>
    el.classList.add('calendar-popup-bar--active')
  );
}

/**
 * Removes highlight from all segments of a multi-day pop-up bar.
 * @param {string} popupId
 */
function unhighlightAllSegments(popupId) {
  document.querySelectorAll(`.calendar-popup-bar[data-event-id="${popupId}"]`).forEach(el =>
    el.classList.remove('calendar-popup-bar--active')
  );
}

/**
 * Formats a Date object as YYYY-MM-DD for use as a cell ID.
 * This helps us uniquely identify each day in the calendar grid.
 * Uses local timezone to avoid date shifts when converting to UTC.
 * @param {Date} date - The date to format.
 * @returns {string} - The formatted date string (e.g., '2025-05-14').
 */
function formatDateId(date) {
    // Use local timezone to format the date, avoiding UTC conversion
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


/**
 * Determines how many pop-up bars are visible in the calendar grid.
 * @returns {number}
 */
function getMaxVisible() {
  return window.innerWidth <= 900 ? 2 : 4;
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
    const grid = document.querySelector('.calendar-grid');
    // Clear any previous calendar grid content
    grid.innerHTML = '';

    // Create Date objects for the first and last day of the month
    const firstDay = new Date(year, month, 1); // e.g., May 1, 2025
    const lastDay = new Date(year, month + 1, 0); // Last day of the month
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 6 = Saturday
    const daysInMonth = lastDay.getDate(); // Number of days in the month

    // Set the calendar header to show the current month and year
    document.querySelector('.calendar-month-year').textContent =
        firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // The calendar grid is always 6 rows of 7 days (to cover all possible month layouts)
    // 'day' starts negative if the month doesn't start on Sunday, so we fill in blanks
    let day = 1 - startDayOfWeek; // May start negative if the month doesn't start on Sunday
    for (let week = 0; week < 6; week++) {
        const row = document.createElement('div'); // Create a row for each week
        row.className = 'calendar-row';
        // Add a bar layer for pop-up bars spanning the week
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

    // After building the grid, place pop-up bars in the correct cells
    placePopupsInGrid(month, year);

    // Reveal the calendar section after calendar is rendered
    const calendarSection = document.querySelector('.calendar-section');
    if (calendarSection) {
        calendarSection.classList.remove('hidden');
        calendarSection.style.display = '';
    }

    // Inject the footer after calendar is rendered
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
        }
      })
      .catch((error) => {
        console.error(error);
      });
}

/**
 * Places pop-up bars in the correct calendar grid cells for the given month/year.
 * Loops through all pop-ups and puts them on the right days (including multi-day).
 * @param {number} month - The month (0-based).
 * @param {number} year - The year (4-digit).
 */
function placePopupsInGrid(month, year) {
  const rows = document.querySelectorAll('.calendar-row');

  // For each week, build a list of pop-ups that touch that week
  for (let week = 0; week < 6; week++) {
    const barLayer = rows[week].querySelector('.calendar-row-bar-layer');
    if (!barLayer) continue;

    // Find the first and last cell index for this week
    const weekStartCell = week * 7;
    const weekEndCell = weekStartCell + 6;

    // Gather all pop-ups that touch this week
    const popupsInWeek = popups.map(popup => {
      const start = popup.start_datetime ? new Date(popup.start_datetime) : null;
      const end = popup.end_datetime ? new Date(popup.end_datetime) : start;
      if (!start) return null;
      let popupStart = new Date(start);
      let popupEnd = new Date(end);

      // --- FIX: Only render pop-ups that overlap the current month ---
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      if (popupEnd < monthStart || popupStart > monthEnd) return null;

      // Clamp popupStart and popupEnd to the visible month
      if (popupStart < monthStart) popupStart = monthStart;
      if (popupEnd > monthEnd) popupEnd = monthEnd;
      const firstDayOfMonth = new Date(year, month, 1);
      const startDayOfWeek = firstDayOfMonth.getDay();
      const popupStartDay = popupStart.getDate();
      const popupEndDay = popupEnd.getDate();

      // Clamp cell indices to the visible grid (0 to 41)
      let startCellIndex = Math.max(0, startDayOfWeek + popupStartDay - 1);
      let endCellIndex = Math.min(41, startDayOfWeek + popupEndDay - 1);

      // If pop-up touches this week
      if (endCellIndex < weekStartCell || startCellIndex > weekEndCell) return null;

      // For this week, what columns does it span?
      const weekStartCol = Math.max(0, startCellIndex - weekStartCell);
      const weekEndCol = Math.min(6, endCellIndex - weekStartCell);

      // Guard: skip if weekStartCol or weekEndCol is NaN
      if (isNaN(weekStartCol) || isNaN(weekEndCol)) return null;

      // Only render if span is valid
      if (weekStartCol > weekEndCol) return null;
      return {
        popup,
        startCellIndex,
        endCellIndex,
        weekStartCol,
        weekEndCol,
        isMultiDay: (startCellIndex !== endCellIndex)
      };
    }).filter(Boolean);

    // Sort: multi-day pop-ups first, then single-day
    popupsInWeek.sort((a, b) => {
      if (a.isMultiDay && !b.isMultiDay) return -1;
      if (!a.isMultiDay && b.isMultiDay) return 1;
      
      // If both are same type, sort by startCellIndex
      return a.startCellIndex - b.startCellIndex;
    });

    const maxVisible = getMaxVisible();
    
    // Map: col (0-6) => array of {pop-up, slot, ...}
    const popupsByDay = Array(7).fill(0).map(() => []);
    // Track slots: slots[col][slotIndex] = true if occupied
    const slots = Array(7).fill(0).map(() => []);
    // For each pop-up, find the first available slot that is free for all days it spans
    popupsInWeek.forEach(({popup, weekStartCol, weekEndCol, isMultiDay, startCellIndex, endCellIndex}) => {
      // Skip bars that would have an invalid span (prevents bleed-over)
      if (weekStartCol > weekEndCol) return;
      let slot = 0;
      outer: for (; slot < MAX_EVENT_BAR_SLOTS; slot++) {
        for (let col = weekStartCol; col <= weekEndCol; col++) {
          if (slots[col][slot]) continue outer;
        }
        break;
      }
      // Mark all columns as occupied in this slot and track pop-ups per day
      for (let col = weekStartCol; col <= weekEndCol; col++) {
        slots[col][slot] = true;
        popupsByDay[col].push({ popup, slot, weekStartCol, weekEndCol, isMultiDay, startCellIndex, endCellIndex });
      }
      // Only render the bar if this pop-up is among the first maxVisible for every day it spans
      let shouldRender = false;
      for (let col = weekStartCol; col <= weekEndCol; col++) {
        if (popupsByDay[col].indexOf(popupsByDay[col].find(e => e.popup === popup && e.slot === slot)) < maxVisible) {
          shouldRender = true;
        } else {
          shouldRender = false;
          break;
        }
      }
      if (!shouldRender) return;
      // Render the bar
      const bar = document.createElement('div');
      bar.className = 'calendar-popup-bar';
      const sanitizedStartDatetime = popup.start_datetime.replace(/[:]/g, '-');
      const uniqueId = `${popup.name.replace(/\s+/g, '-').toLowerCase()}-${sanitizedStartDatetime}`;
      bar.setAttribute('data-event-id', uniqueId);
      popup._calendarUniqueId = uniqueId;

      // Accessibility and highlight logic
      bar.tabIndex = 0;
      bar.setAttribute('aria-label', popup.name);
      const popupId = bar.getAttribute('data-event-id');
      bar.addEventListener('mouseenter', () => highlightAllSegments(popupId));
      bar.addEventListener('focus', () => highlightAllSegments(popupId));
      bar.addEventListener('mouseleave', () => unhighlightAllSegments(popupId));
      bar.addEventListener('blur', () => unhighlightAllSegments(popupId));
      bar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.key === ' ') {
            e.preventDefault();
          }
          window.location.href = `pop-up.html?id=${popup.id}`;
        }
      });
      bar.addEventListener('click', (e) => {
        document.querySelectorAll('.calendar-popup-bar--active').forEach(el => el.classList.remove('calendar-popup-bar--active'));
        highlightAllSegments(popupId);
        e.stopPropagation();
        window.location.href = `pop-up.html?id=${popup.id}`;
      });

      // Show pop-up name:
      // - For single-day pop-ups, always show the name
      // - For multi-day pop-ups, only show on first week and first slot
      let showName = false;
      if (!isMultiDay) {
        showName = true;
      } else if (
        (week === Math.floor(startCellIndex / 7) && weekStartCol === (startCellIndex % 7)) ||
        weekStartCol === 0
      ) {
        showName = true;
      }
      if (showName) {
        const titleSpan = document.createElement('span');
        titleSpan.className = 'calendar-popup-bar__title';
        titleSpan.textContent = popup.name;
        bar.appendChild(titleSpan);
      }
      bar.tabIndex = 0;
      bar.setAttribute('aria-label', popup.name); // Accessibility improvement
      bar.style.position = 'absolute';
      bar.style.left = `calc(${weekStartCol} * 100% / 7 + ${EVENT_BAR_HORIZONTAL_MARGIN_PX}px)`;
      bar.style.width = `calc(${(weekEndCol - weekStartCol + 1)} * 100% / 7 - ${EVENT_BAR_HORIZONTAL_MARGIN_PX * 2}px)`;
      bar.style.top = `${slot * EVENT_BAR_VERTICAL_SPACING_PX}px`;
      bar.style.height = `${EVENT_BAR_HEIGHT_PX}px`;
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
      // Debug: log the number of pop-ups for this day
      // console.log(`Week ${week}, Col ${col}: popupsByDay[col].length =`, popupsByDay[col].length);
      if (popupsByDay[col].length > maxVisible) {
        // Find the cell for this week and column
        // barLayer is first child, so cell is children[col + 1]
        const cell = rows[week].children[col + 1];
        if (!cell.querySelector('.calendar-more-link')) { // Prevent duplicate links
          // Remove debug background color for production
          cell.style.backgroundColor = '';
          const moreLink = document.createElement('div');
          moreLink.className = 'calendar-more-link calendar-more-link--absolute';
          moreLink.textContent = `+${popupsByDay[col].length - maxVisible} more`;
          moreLink.tabIndex = 0;
          moreLink.setAttribute('aria-label', `Show ${popupsByDay[col].length - maxVisible} more pop-ups for this day`); // Accessibility
          moreLink.addEventListener('click', (e) => {
            e.stopPropagation();
            // Calculate the date for this cell
            const firstDayOfMonth = new Date(year, month, 1);
            const startDayOfWeek = firstDayOfMonth.getDay();
            const cellDay = week * 7 + col - startDayOfWeek + 1;
            const cellDate = new Date(year, month, cellDay);
            // Find all pop-ups (from global popups array) that occur on this date
            const cellDateId = formatDateId(cellDate);
            const popupsForDay = popups.filter(popup => {
              // Parse popup start/end
              const start = popup.start_datetime ? new Date(popup.start_datetime) : null;
              const end = popup.end_datetime ? new Date(popup.end_datetime) : start;
              if (!start) return false;
              // Clamp popup end to popup start if missing
              const popupStart = new Date(start);
              const popupEnd = end ? new Date(end) : popupStart;
              // Check if cellDate is between popupStart and popupEnd (inclusive, by day)
              const cellYMD = cellDateId;
              const startYMD = formatDateId(popupStart);
              const endYMD = formatDateId(popupEnd);
              // Debug logs removed for production
              return cellYMD >= startYMD && cellYMD <= endYMD;
            });
            // Debug logs removed for production
              openDayPopupsModal(cellDate, popupsForDay);
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
  // Only run on calendar.html (where .calendar-grid exists)
  if (document.querySelector('.calendar-grid')) {
    // Fetch the pop-up data from the Google Sheet CSV (URL is defined in pop-ups.js)
    fetch(GOOGLE_SHEET_CSV_URL)
      .then(res => res.text()) // Get the CSV as text
      .then(csv => {
        // Parse the CSV and filter out hidden pop-ups
        popups = parseCSV(csv)
          .filter(e =>
            String(e.master_display).toUpperCase() === 'TRUE' &&
            String(e.calendar).toUpperCase() === 'TRUE'
          );
        // Render the calendar for the current month and year
        renderCalendar(currentMonth, currentYear);
      })
      .catch(err => {
        // User-facing error handling
        const calendarSection = document.querySelector('.calendar-section');
        if (calendarSection) {
          let errorDiv = calendarSection.querySelector('.calendar-error');
          if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'calendar-error';
            errorDiv.textContent = 'Failed to load calendar pop-ups. Please try again later.';
            errorDiv.style.color = 'var(--nyc-red, #c00)';
            errorDiv.style.textAlign = 'center';
            errorDiv.style.margin = 'var(--space-md) 0';
            calendarSection.appendChild(errorDiv);
          }
        }
        console.error('Failed to load calendar pop-ups:', err);
      });
    // Set up the previous month button
    document.querySelector('.calendar-header__prev-month').onclick = () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11; // Wrap to December
        currentYear--;
      }
      renderCalendar(currentMonth, currentYear); // Re-render with new month
    };
    // Set up the next month button
    document.querySelector('.calendar-header__next-month').onclick = () => {
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