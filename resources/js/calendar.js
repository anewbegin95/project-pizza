// Wait for the entire document to be ready before running the code
document.addEventListener('DOMContentLoaded', function () {
    // Get the calendar container element by its ID
    const calendarEl = document.getElementById('calendar');
  
    // Initialize FullCalendar with the necessary options and plugins
    const calendar = new FullCalendar.Calendar(calendarEl, {
      // Specify the plugins we want to use: dayGrid (month view) and interaction (click and drag events)
      plugins: [FullCalendar.dayGridPlugin, FullCalendar.interactionPlugin],
      
      // Initial view when the calendar loads (month view)
      initialView: 'dayGridMonth',
  
      // Header toolbar configuration: buttons on the top for navigation and current view
      headerToolbar: {
        left: 'prev,next today', // Navigation buttons for previous, next, and today
        center: 'title',         // Display the calendar title in the center
        right: 'dayGridMonth'    // Right side shows the "Month View"
      },
  
      // Define events to show on the calendar
      events: [
        {
          title: 'Test Event',    // Event title
          start: '2025-04-15',    // Event start date
          end: '2025-04-17',      // Event end date
          description: 'This is a test event.'  // Event description (extendedProps)
        }
      ],
  
      // Event click handler: shows an alert with event title and description
      eventClick: function (info) {
        alert(`Event: ${info.event.title}\nDetails: ${info.event.extendedProps.description}`);
      }
    });
  
    // Render the calendar on the page
    calendar.render();
  });
  