document.addEventListener("DOMContentLoaded", () => {
  const comicDetails = document.getElementById("comic-details");
  const spinner = document.getElementById("spinner");
  const urlParams = new URLSearchParams(window.location.search);
  const comicId = urlParams.get("id");

  if (!comicId) {
    comicDetails.innerHTML = "<p>Comic not found.</p>";
    return;
  }

  spinner.style.display = "block";

  fetch(`${API_BASE_URL}/comics/${comicId}`)
  .then(res => res.json())
  .then(comic => {

      if (!comic) {
        comicDetails.innerHTML = "<p>Comic not found.</p>";
        spinner.style.display = "none";
        return;
      }

      const progress = JSON.parse(localStorage.getItem(`progress_${comic.id}`));

      const container = document.createElement("div");
      container.innerHTML = `
        <a href="/comic" class="back-link">⬅ Back to comics page</a>
        <h2>${comic.title}</h2>
        <img src="${comic.cover || 'assets/default-cover.jpg'}" alt="${comic.title}" />
        <p><strong>Author:</strong> ${comic.author}</p>
        <p><strong>Penciller:</strong> ${comic.penciller}</p>
        <p><strong>Genre:</strong> ${comic.genre}</p>
        <p>${comic.description}</p>
        <p><strong>Status:</strong> ${comic.status}</p>
        <p><strong>Source:</strong> ${comic.source}</p>
        <h3>Chapters (${comic.chapters.length})</h3>
        <div id="chapter-list"></div>
      `;
      comicDetails.appendChild(container);

      const chapterList = container.querySelector("#chapter-list");

      comic.chapters.forEach(chapter => {
        const thumb = chapter.images?.[0] || `${comic.title}`;
        const card = document.createElement("a");
        card.href = `/read?comic=${comic.id}&chapter=${chapter.id}`;
        card.classList.add("chapter-card-link");
        card.setAttribute("data-chapter", chapter.id.toString().toLowerCase());
        card.style.display = "flex";
        card.style.alignItems = "center";
        card.style.gap = "15px";
        card.style.padding = "10px";
        card.style.border = "1px solid #ccc";
        card.style.background = "#111";
        card.style.borderRadius = "8px";
        card.style.textDecoration = "none";
        card.style.color = "#fff";

        let lastReadHTML = "";
        if (progress && progress.chapterId === chapter.id) {
          lastReadHTML = `<div style="color: lightgreen; font-size: 0.9em;">Resume</div>`;
        }

        card.innerHTML = `
        <div class="chapter-grid">
          <img src="${thumb}" onerror="this.src='assets/default-thumb.jpg'" />
          <div class="chapter-number">
            <span class="chapter-id">${chapter.id.toString().padStart(3, '0')}</span>
            <span class="last-read">${lastReadHTML}</span>
          </div>
        </div>
        `;

        chapterList.appendChild(card);
      });


      spinner.style.display = "none";
    })
    .catch(err => {
      comicDetails.innerHTML = "<p>Error loading comic details.</p>";
      console.error(err);
      spinner.style.display = "none";
    });
});
