document.addEventListener("DOMContentLoaded", () => {
  const JSZip = window.JSZip;

  const readerContainer = document.getElementById("reader-container");
  const spinner = document.getElementById("spinner");

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
        <a href="/chapter?id=${comic.id}" class="back-link">⬅ Back to ${comic.title}</a>
      `;

      readerContainer.appendChild(header);

      const chapterSelectWrapper = document.createElement("div");
      chapterSelectWrapper.className = "mystical-dropdown-wrapper";

      const chapterSelect = document.createElement("select");
      chapterSelect.className = "mystical-dropdown";

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
          window.location.href = `/read?comic=${comic.id}&chapter=${selectedId}`;
        }
      });

      chapterSelectWrapper.appendChild(chapterSelect);
      readerContainer.appendChild(chapterSelectWrapper);

      // unified imageElements declaration
      let imageElements = [];

      if (chapter.cbz) {
        // 📦 CBZ MODE
        fetch(chapter.cbz)
          .then(res => res.arrayBuffer())
          .then(async (arrayBuffer) => {
            const zip = await JSZip.loadAsync(arrayBuffer);
            const entries = Object.values(zip.files)
            .filter(f => !f.dir && /\.(png|jpe?g|gif)$/i.test(f.name))
            .sort((a, b) => {
              // numeric sort based on filename
              const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
              const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
              return numA - numB;
            });

            const totalImages = entries.length;
            let imagesLoaded = 0;

            for (const [index, entry] of entries.entries()) {
              const blob = await entry.async("blob");
              const imageElement = document.createElement("img");
              imageElement.src = URL.createObjectURL(blob);
              imageElement.alt = `Page ${index + 1}`;
              imageElement.style.width = "100%";
              imageElement.style.display = "block";
              imageElement.className = "chapter-image";

              imageElement.onload = () => {
                imagesLoaded++;
                if (imagesLoaded === totalImages && spinner) spinner.style.display = "none";
              };

              readerContainer.appendChild(imageElement);
              imageElements.push(imageElement);
            }

            document.dispatchEvent(new Event("chapterLoaded"));
          })
          .catch(err => {
            console.error("Error loading CBZ:", err);
            readerContainer.innerHTML += "<p>Failed to load CBZ.</p>";
            if (spinner) spinner.style.display = "none";
          });

      } else if (Array.isArray(chapter.images) && chapter.images.length > 0) {
        // 🖼️ FALLBACK TO NORMAL IMAGES
        let imagesLoaded = 0;
        const totalImages = chapter.images.length;

        chapter.images.forEach((imageUrl, index) => {
          const imageElement = document.createElement("img");
          imageElement.src = imageUrl;
          imageElement.alt = `Page ${index + 1}`;
          imageElement.style.width = "100%";
          imageElement.style.display = "block";
          imageElement.className = "chapter-image";

          imageElement.onload = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImages && spinner) spinner.style.display = "none";
          };

          imageElement.onerror = () => {
            imageElement.src = "../assets/missing-page.jpg";
            imagesLoaded++;
            if (imagesLoaded === totalImages && spinner) spinner.style.display = "none";
          };

          readerContainer.appendChild(imageElement);
          imageElements.push(imageElement);
        });

        document.dispatchEvent(new Event("chapterLoaded"));
      } else {
        readerContainer.innerHTML += "<p>No images found for this chapter.</p>";
        if (spinner) spinner.style.display = "none";
      }

      const chapterKey = `chapter-${chapter.id}`; // fixed: use actual chapter.id
      const scrollKey = `${chapterKey}-scroll`;
      const progressKey = `${chapterKey}-progress`;

      function initProgressTracking() {
        imageElements = document.querySelectorAll("#reader-container img");

        if (!imageElements.length) {
          console.log("No images found yet, retrying...");
          setTimeout(initProgressTracking, 500); // retry until content loads
          return;
        }

        console.log(`Found ${imageElements.length} images for tracking`);

        // Restore last scroll position
        const savedScroll = localStorage.getItem(scrollKey);
        if (savedScroll) {
          window.scrollTo(0, parseInt(savedScroll, 10));
        }

        // Restore last read progress (highlight)
        const savedProgress = localStorage.getItem(progressKey);
        if (savedProgress && imageElements[savedProgress]) {
          imageElements[savedProgress].classList.add("last-read");
        }

        // Save progress as user scrolls
        window.addEventListener("scroll", () => {
          localStorage.setItem(scrollKey, window.scrollY);

          let currentIndex = 0;
          imageElements.forEach((img, i) => {
            const rect = img.getBoundingClientRect();
            if (rect.top < window.innerHeight / 2) {
              currentIndex = i;
            }
          });

          localStorage.setItem(progressKey, currentIndex);
        });
      }

      // Hook for JSON style → when images are appended immediately
      document.addEventListener("DOMContentLoaded", () => {
        initProgressTracking();
      });

      // Hook for CBZ style → when new chapter content is dynamically injected
      document.addEventListener("chapterLoaded", () => {
        initProgressTracking();
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
            window.location.href = `/read?comic=${comic.id}&chapter=${nextChapter.id}`;
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
              window.location.href = `/read?comic=${comic.id}&chapter=${prevChapter.id}`;
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
            window.location.href = `/read?comic=${comic.id}&chapter=${nextChapter.id}`;
          }
        }

        if (e.key === "ArrowLeft" && currentIndex > 0) {
          const prevChapter = chapters[currentIndex - 1];
          if (confirm("Go to previous chapter?")) {
            window.location.href = `/read?comic=${comic.id}&chapter=${prevChapter.id}`;
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
});