async function fetchAndDisplayEvents() {
    const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?output=csv";
  
    try {
      const response = await fetch(csvUrl);
      const csvText = await response.text();
  
      const rows = csvText.trim().split("\n");
      const headers = rows.shift().split(",");
  
      const prefixIndex = headers.indexOf("prefix");
      const linkTextIndex = headers.indexOf("link text");
      const linkIndex = headers.indexOf("link");
      const suffixIndex = headers.indexOf("suffix");
  
      const eventsSection = document.getElementById("events");
      const ul = document.createElement("ul");
  
      rows.forEach(row => {
        const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"|"$/g, '').trim());
  
        const prefix = cols[prefixIndex] || "";
        const linkText = cols[linkTextIndex] || "";
        const link = cols[linkIndex] || "#";
        const suffix = cols[suffixIndex] || "";
  
        const li = document.createElement("li");
        li.innerHTML = `${prefix} <a href="${link}" target="_blank">${linkText}</a> ${suffix}`;
        ul.appendChild(li);
      });
  
      eventsSection.innerHTML = `<h2>Featured NYC Experiences</h2>`;
      eventsSection.appendChild(ul);
  
    } catch (error) {
      console.error("Error loading events from Google Sheets:", error);
    }
  }
  
  fetchAndDisplayEvents();
  