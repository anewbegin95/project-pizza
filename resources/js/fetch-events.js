// This function fetches event data from a public Google Sheet and updates the page dynamically
async function fetchAndDisplayEvents() {
    // The published CSV URL from your Google Sheet
    const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=0&single=true&output=csv";
  
    try {
        // Fetch the CSV file as plain text
        const response = await fetch(csvUrl);
        const csvText = await response.text();
  
        // Split the CSV into rows (the first row contains headers)
        const rows = csvText.trim().split("\n");
  
        // Extract the headers (e.g. prefix, link text, link, suffix)
        const headers = rows.shift().split(",");
  
        // Get the index of each column so we can map the data correctly
        const prefixIndex = headers.indexOf("prefix");
        const linkTextIndex = headers.indexOf("link_text");
        const linkIndex = headers.indexOf("link");
        const suffixIndex = headers.indexOf("suffix");
  
        // Find the <section> element with id="events" in your HTML
        const eventsSection = document.getElementById("events");
  
        // Create a new unordered list to hold all the event items
        const ul = document.createElement("ul");
  
        // Loop through each remaining row of data
        rows.forEach(row => {
            // Debugging: Log the raw row data
            console.log("Raw row data:", row);

            // Split by commas that aren't inside quotes (to avoid breaking if text includes commas)
            const cols = row
                .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                .map(col => col.replace(/^"|"$/g, '').trim()); // Remove surrounding quotes and trim whitespace
  
            // Safely get each cell by column index
            const prefix = cols[prefixIndex] || "";
            const linkText = cols[linkTextIndex] || "";
            const link = cols[linkIndex] || "#";
            const suffix = cols[suffixIndex] || "";

            // Debugging: Log the processed values
            console.log({ prefix, linkText, link, suffix });

            // Warn if suffix is missing
            if (!suffix) {
                console.warn("Missing suffix for event:", { prefix, linkText, link });
            }
  
            // Create a new <li> element for the event
            const li = document.createElement("li");
  
            // Inject the event content into the <li>, combining prefix + link + suffix
            li.innerHTML = `${prefix} <a href="${link}" target="_blank" rel="noopener noreferrer">${linkText}</a>${suffix ? ` | ${suffix}` : ""}`;
  
            // Add this <li> to the <ul>
            ul.appendChild(li);
        });
  
        // Clear any existing content and add a header
        eventsSection.innerHTML = `<h2>Featured NYC Experiences</h2>`;
  
        // Append the new event list to the section
        eventsSection.appendChild(ul);
  
    } catch (error) {
        // Log any errors if something goes wrong (like a broken link or bad sheet data)
        console.error("Error loading events from Google Sheets:", error);
    }
}
  
// Run the function when the script loads
fetchAndDisplayEvents();