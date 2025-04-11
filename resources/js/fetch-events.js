// This function fetches event data from a public Google Sheet and updates the page dynamically
async function fetchAndDisplayEvents() {
    // The published CSV URL from your Google Sheet
    // Ensure the Google Sheet is published and accessible to "Anyone with the link"
    const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=0&single=true&output=csv";

    try {
        // Fetch the CSV file as plain text
        console.log("Fetching data from:", csvUrl);
        const response = await fetch(csvUrl);

        // Check if the response is successful
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log("CSV data fetched successfully.");

        // Split the CSV into rows (the first row contains headers)
        const rows = csvText.trim().split("\n");
        console.log("Rows extracted:", rows);

        // Extract the headers (e.g., prefix, link_text, link, suffix)
        const headers = rows.shift().split(",").map(header => header.trim());
        console.log("Headers:", headers);

        // Get the index of each column so we can map the data correctly
        // These indices are used to extract the correct data from each row
        const prefixIndex = headers.indexOf("prefix");
        const linkTextIndex = headers.indexOf("link_text");
        const linkIndex = headers.indexOf("link");
        const suffixIndex = headers.indexOf("suffix");

        console.log("Column indices:", { prefixIndex, linkTextIndex, linkIndex, suffixIndex });

        // Check if any required column is missing
        if (prefixIndex === -1 || linkTextIndex === -1 || linkIndex === -1 || suffixIndex === -1) {
            throw new Error("One or more required columns are missing in the CSV file.");
        }

        // Find the <section> element with id="events" in your HTML
        const eventsSection = document.getElementById("events");
        if (!eventsSection) {
            throw new Error("No element with id 'events' found in the HTML.");
        }

        // Create a new unordered list to hold all the event items
        const ul = document.createElement("ul");

        // Loop through each remaining row of data
        rows.forEach((row, rowIndex) => {
            // Debugging: Log the raw row data for troubleshooting
            console.log(`Processing row ${rowIndex + 1}:`, row);

            // Split by commas that aren't inside quotes (to avoid breaking if text includes commas)
            const cols = row
                .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/) // Regex to handle commas inside quotes
                .map(col => col.replace(/^"|"$/g, '').trim()); // Remove surrounding quotes and trim whitespace

            console.log("Parsed columns:", cols);

            // Safely get each cell by column index
            // If a column is missing, default to an empty string or placeholder
            const prefix = cols[prefixIndex] || "";
            const linkText = cols[linkTextIndex] || "";
            const link = cols[linkIndex] || "#"; // Default to "#" if no link is provided
            const suffix = cols[suffixIndex] || "";

            // Debugging: Log the processed values for each row
            console.log({ prefix, linkText, link, suffix });

            // Warn if suffix is missing
            if (!suffix) {
                console.warn("Missing suffix for event:", { prefix, linkText, link });
            }

            // Create a new <li> element for the event
            const li = document.createElement("li");

            // Inject the event content into the <li>, combining prefix + link + suffix
            // Use a fallback for missing suffix values
            li.innerHTML = `${prefix} <a href="${link}" target="_blank" rel="noopener noreferrer">${linkText}</a>${suffix ? ` | ${suffix}` : ""}`;

            // Add this <li> to the <ul>
            ul.appendChild(li);
        });

        // Clear any existing content in the events section and add a header
        eventsSection.innerHTML = `<h2>Featured NYC Experiences</h2>`;

        // Append the new event list to the section
        eventsSection.appendChild(ul);
        console.log("Events successfully displayed on the page.");

    } catch (error) {
        // Log any errors if something goes wrong (like a broken link or bad sheet data)
        console.error("Error loading events from Google Sheets:", error);
    }
}

// Run the function when the script loads
fetchAndDisplayEvents();