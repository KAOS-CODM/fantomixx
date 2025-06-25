document.addEventListener("DOMContentLoaded", () => {
  const comicList = document.getElementById("comic-list");
  const spinner = document.getElementById("spinner"); // Spinner element

  // Show spinner at start
  if (spinner) spinner.style.display = "flex";

  fetch(`${API_BASE_URL}/comics`)
    .then(res => res.json())
    .then(comics => {
      comics.forEach(comic => {
        const card = document.createElement("a");
        card.href = `chapter.html?id=${comic.id}`;
        card.classList.add("comic-card-link");
        card.setAttribute("data-title", comic.title.toLowerCase());
        card.setAttribute("data-genre", comic.genre?.toLowerCase() || "unknown");

        card.innerHTML = `
          <div class="comic-card">
            <img src="${comic.cover || 'assets/default-cover.jpg'}" alt="${comic.title}">
            <h3 class="comic-title">${comic.title}</h3>
          </div>
        `;
        comicList.appendChild(card);
      });

      // Hide spinner after loading
      if (spinner) spinner.style.display = "none";
    })
    .catch(err => {
      comicList.innerHTML = "<p>Error loading comics.</p>";
      console.error("Failed to load comics.json", err);

      // Hide spinner on error
      if (spinner) spinner.style.display = "none";
    });
});
