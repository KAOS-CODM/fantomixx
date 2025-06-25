document.addEventListener("DOMContentLoaded", () => {
  const readerContainer = document.getElementById("reader-container");
  const spinner = document.getElementById("spinner"); // Spinner div

  const urlParams = new URLSearchParams(window.location.search);
  const comicId = urlParams.get("comic");
  const chapterId = urlParams.get("chapter");

  if (!comicId || !chapterId) {
    readerContainer.innerHTML = "<p>Comic or chapter not specified.</p>";
    if (spinner) spinner.style.display = "none";
    return;
  }

  if (spinner) spinner.style.display = "flex";

   fetch(`${API_BASE_URL}/comics/${comicId}`)
    .then(res => res.json())
    .then(comic => {
      if (!comic) {
        readerContainer.innerHTML = "<p>Comic not found.</p>";
        if (spinner) spinner.style.display = "none";
        return;
      }

      const chapters = comic.chapters;
      const currentIndex = chapters.findIndex(ch => ch.id === chapterId);
      const chapter = chapters[currentIndex];

      if (!chapter) {
        readerContainer.innerHTML = "<p>Chapter not found.</p>";
        if (spinner) spinner.style.display = "none";
        return;
      }

      const toggleWrapper = document.createElement("div");
      toggleWrapper.className = "toggle-wrapper";
      toggleWrapper.innerHTML = `
        <label class="auto-nav-label">Auto Navigation</label>
        <label class="switch">
          <input type="checkbox" id="autoNavToggle">
          <span class="slider"></span>
        </label>
      `;
      readerContainer.appendChild(toggleWrapper);

      const autoNavToggle = toggleWrapper.querySelector("#autoNavToggle");
      const AUTO_NAV_KEY = "autoNavEnabled";
      autoNavToggle.checked = localStorage.getItem(AUTO_NAV_KEY) === "true";

      autoNavToggle.addEventListener("change", () => {
        localStorage.setItem(AUTO_NAV_KEY, autoNavToggle.checked);
      });

      const header = document.createElement("div");
      header.className = "reader-header";
      header.innerHTML = `
        <h2>${comic.title} - Chapter ${chapter.id}</h2>
        <a href="comic.html?id=${comic.id}" class="back-link">⬅ Back to ${comic.title}</a>
      `;
      readerContainer.appendChild(header);

      const chapterSelectWrapper = document.createElement("div");
      chapterSelectWrapper.className = "mystical-dropdown-wrapper";

const chapterSelect = document.createElement("select");
chapterSelect.className = "mystical-dropdown";

// Populate dropdown
chapters.forEach(ch => {
  const option = document.createElement("option");
  option.value = ch.id;
  option.textContent = `Chapter ${ch.id}`;
  if (ch.id === chapter.id) option.selected = true;
  chapterSelect.appendChild(option);
});

chapterSelect.addEventListener("change", () => {
  const selectedId = chapterSelect.value;
  if (selectedId !== chapter.id) {
    window.location.href = `read.html?comic=${comic.id}&chapter=${selectedId}`;
  }
});

chapterSelectWrapper.appendChild(chapterSelect);
readerContainer.appendChild(chapterSelectWrapper);


chapterSelectWrapper.appendChild(chapterSelect);
readerContainer.appendChild(chapterSelectWrapper);


      const imageElements = [];

      let imagesLoaded = 0;
      const totalImages = chapter.images.length;

      function hideSpinnerIfAllLoaded() {
        if (imagesLoaded === totalImages) {
          if (spinner) spinner.style.display = "none";
        }
      }

      if (!Array.isArray(chapter.images) || chapter.images.length === 0){
        readerContainer.innerHTML += "<p>No images found fro this chapter.</p>";
        if (spinner) spinner.style.display = "none";
        return;
      }
      chapter.images.forEach((imageUrl, index) => {
        const imageElement = document.createElement("img");
        imageElement.src = imageUrl;
        imageElement.alt =`Page${index+1}`;
        imageElement.style.width = "100%";
        imageElement.style.display = "block";
        imageElement.className = "chapter-image";
        imageElement.onerror = () => {
          imageElement.src = "assets/missing-page.jpg";
          hideSpinnerIfAllLoaded();
        };

        if (imageElement.complete) {
          imagesLoaded++;
          hideSpinnerIfAllLoaded();
        } else {
          imageElement.onload = () => {
            imagesLoaded++;
            hideSpinnerIfAllLoaded();
          };
          imageElement.onerror = () => {
            imagesLoaded++;
            hideSpinnerIfAllLoaded();
          };
        }

        readerContainer.appendChild(imageElement);
        imageElements.push(imageElement);
      });

      const scrollKey = `scroll_${comic.id}_${chapter.id}`;
      const savedScrollY = parseInt(localStorage.getItem(scrollKey));

      if (!isNaN(savedScrollY)) {
        let loadedCount = 0;
        imageElements.forEach(img => {
          if (img.complete) {
            loadedCount++;
          } else {
            img.addEventListener("load", () => {
              loadedCount++;
              if (loadedCount === imageElements.length) {
                window.scrollTo(0, savedScrollY);
              }
            });
          }
        });

        if (loadedCount === imageElements.length) {
          window.scrollTo(0, savedScrollY);
        }
      }

      let scrollTimeout;
      window.addEventListener("scroll", () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          let lastVisibleIndex = 0;

          imageElements.forEach((img, i) => {
            const rect = img.getBoundingClientRect();
            if (rect.top >= 0 && rect.top < window.innerHeight) {
              lastVisibleIndex = i;
            }
          });

          imageElements.forEach((img, i) => {
            img.style.boxShadow = i === lastVisibleIndex ? "0 0 10px lime" : "none";
          });

          const progressKey = `progress_${comic.id}`;
          localStorage.setItem(progressKey, JSON.stringify({
            chapterId: chapter.id,
            page: lastVisibleIndex + 1
          }));

          localStorage.setItem(scrollKey, window.scrollY);
        }, 100);
      });

      let switched = false;
      let topScrollCount = 0;
      let topScrollTimer;

      window.addEventListener("scroll", () => {
        if (!autoNavToggle.checked || switched) return;

        const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 50;
        const nearTop = window.scrollY <= 10;

        if (nearBottom && currentIndex < chapters.length - 1) {
          switched = true;
          const nextChapter = chapters[currentIndex + 1];
          if (confirm("You've reached the end. Go to the next chapter?")) {
            window.location.href = `read.html?comic=${comic.id}&chapter=${nextChapter.id}`;
          } else {
            switched = false;
          }
        }

        if (nearTop) {
          topScrollCount++;

          clearTimeout(topScrollTimer);
          topScrollTimer = setTimeout(() => {
            topScrollCount = 0;
          }, 2000);

          if (topScrollCount >= 2 && currentIndex > 0) {
            switched = true;
            const prevChapter = chapters[currentIndex - 1];
            if (confirm("Go back to the previous chapter?")) {
              window.location.href = `read.html?comic=${comic.id}&chapter=${prevChapter.id}`;
            } else {
              switched = false;
            }
            topScrollCount = 0;
          }
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" && currentIndex < chapters.length - 1) {
          const nextChapter = chapters[currentIndex + 1];
          if (confirm("Go to next chapter?")) {
            window.location.href = `read.html?comic=${comic.id}&chapter=${nextChapter.id}`;
          }
        }

        if (e.key === "ArrowLeft" && currentIndex > 0) {
          const prevChapter = chapters[currentIndex - 1];
          if (confirm("Go to previous chapter?")) {
            window.location.href = `read.html?comic=${comic.id}&chapter=${prevChapter.id}`;
          }
        }

        if (e.key.toLowerCase() === "a") {
          autoNavToggle.checked = !autoNavToggle.checked;
          localStorage.setItem(AUTO_NAV_KEY, autoNavToggle.checked);
          alert(`Auto Navigation ${autoNavToggle.checked ? "enabled" : "disabled"}`);
        }
      });

    })
    .catch(err => {
      readerContainer.innerHTML = "<p>Error loading chapter.</p>";
      console.error(err);
      if (spinner) spinner.style.display = "none";
    });
  })
