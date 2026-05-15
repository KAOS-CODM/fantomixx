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

      const progress = JSON.parse(localStorage.getItem(`progress_${comic.id}`) || 'null');

      const container = document.createElement("div");
      container.innerHTML = `
        <a href="/comic" class="back-link">⬅ Back to comics page</a>
        <h2>${comic.title}</h2>
        <img src="${comic.cover_url || comic.cover || 'assets/default-cover.jpg'}" alt="${comic.title}" />
        <div class="metadata">
          <p><strong>Author:</strong> ${comic.author}</p>
          <p><strong>Penciller:</strong> ${comic.penciller}</p>
          <p><strong>Genre:</strong> ${comic.genre}</p>
          <p>${comic.description}</p>
          <p><strong>Status:</strong> ${comic.status}</p>
          <p><strong>Source:</strong> ${comic.source}</p>
        </div>
        <h3>Chapters (${comic.chapters.length})</h3>
        <div id="chapter-list"></div>
      `;
      comicDetails.appendChild(container);

      const chapterList = container.querySelector("#chapter-list");

      comic.chapters.forEach(chapter => {
        let thumb;
        if (chapter.cbz) {
          thumb = comic.cover_url || comic.cover;
        } else {
          thumb = chapter.images?.[0] || "assets/default-thumb.jpg";
        }
        const card = document.createElement("a");
        card.href = `/read?comic=${comic.id}&chapter=${chapter.id}`;
        card.classList.add("chapter-card-link");

        const chapterLabel = `Chapter ${chapter.title}`;
        let lastReadHTML = "";

        if (progress && progress.chapterId === chapter.id) {
          const pageInfo = progress.pageIndex !== undefined ? `Page ${progress.pageIndex + 1}` : "Resume";
          lastReadHTML = `<div class="resume-badge">Resume ${pageInfo}</div>`;
        }

        card.innerHTML = `
        <div class="chapter-card">
          <div class="chapter-card__thumb">
            <img loading="lazy" src="${thumb}" onerror="this.src='assets/default-thumb.png'" alt="${chapterLabel}" />
          </div>
          <div class="chapter-card__meta">
            <div class="chapter-card__subtitle">${chapter.title && chapter.title !== "" ? chapter.title : "Untitled chapter"}</div>
            <div class="chapter-card__footer">
              <span class="chapter-card__number">#${chapter.title.toString().padStart(3, '0')}</span>
              ${lastReadHTML || '<span class="chapter-card__placeholder">Start reading</span>'}
            </div>
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
