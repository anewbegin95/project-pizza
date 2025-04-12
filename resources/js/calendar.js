// Initialize the current date and set the default selected month and year
let currentDate = new Date();
let selectedMonth = currentDate.getMonth(); // 0-based index (0 = January)
let selectedYear = currentDate.getFullYear(); // Current year

// Get references to the calendar table and month-year span
const calendarTable = document.getElementById('calendar-table').getElementsByTagName('tbody')[0];
const monthYear = document.getElementById('month-year');

// Function to render the calendar
function renderCalendar() {
    // Clear the previous table content
    calendarTable.innerHTML = '';

    // Set the header to the current month and year (e.g., "April 2025")
    monthYear.textContent = `${currentDate.toLocaleString('default', { month: 'long' })} ${selectedYear}`;

    // Get the first day of the month (0 = Sunday, 1 = Monday, etc.)
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate(); // Get the total number of days in the month

    let row = calendarTable.insertRow(); // Create a new row for the calendar grid
    let cell;

    // Add empty cells for the days of the previous month
    for (let i = 0; i < firstDay; i++) {
        cell = row.insertCell(); // Empty cell for the previous month
    }

    // Add cells for each day of the current month
    for (let day = 1; day <= daysInMonth; day++) {
        if ((firstDay + day - 1) % 7 === 0) {
            row = calendarTable.insertRow(); // Start a new row for each week
        }
        cell = row.insertCell();
        cell.textContent = day; // Display the day number

        // Add an event listener to show an alert when a date is clicked
        cell.addEventListener('click', function () {
            alert(`Event for ${selectedMonth + 1}/${day}/${selectedYear}`);
        });
    }
}

// Function to change the month when the user clicks next/previous
function changeMonth(offset) {
    selectedMonth += offset; // Offset adjusts the month by 1 (previous or next)
    if (selectedMonth < 0) { // If the month goes below 0 (before January), move to December of the previous year
        selectedMonth = 11;
        selectedYear--;
    } else if (selectedMonth > 11) { // If the month goes beyond 11 (after December), move to January of the next year
        selectedMonth = 0;
        selectedYear++;
    }
    renderCalendar(); // Re-render the calendar with the new month
}

// Initial render of the calendar
renderCalendar();
