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
        <h2>${comic.title} - Chapter ${chapter.title}</h2>
        <a href="/chapter?id=${comic.id}" class="back-link"><button>⬅ Back to ${comic.title}</button></a>
      `;

      readerContainer.appendChild(header);

      const chapterSelectWrapper = document.createElement("div");
      chapterSelectWrapper.className = "mystical-dropdown-wrapper";

      const chapterSelect = document.createElement("select");
      chapterSelect.className = "mystical-dropdown";

      chapters.forEach(ch => {
        const option = document.createElement("option");
        option.value = ch.title;
        option.textContent = `Chapter ${ch.title}`;
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
        // 📦 CBZ MODE - OPTIMIZED PROGRESSIVE LOADING
        (async () => {
          try {
            console.log("Fetching CBZ for chapter:", chapter.cbz);

            const res = await fetch(chapter.cbz);
            if (!res.ok) throw new Error(`Failed to fetch CBZ: ${res.status}`);

            const arrayBuffer = await res.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);

            let entries = [];
            zip.forEach((relativePath, zipEntry) => {
              if (!zipEntry.dir && /\.(png|jpe?g|gif)$/i.test(zipEntry.name)) {
                entries.push(zipEntry);
              }
            });

            if (!entries.length) {
              readerContainer.innerHTML += "<p>No images found in CBZ.</p>";
              if (spinner) spinner.style.display = "none";
              return;
            }

            // --- Hybrid sorting logic ---
            function extractNumber(name) {
              const match = name.match(/(\d{1,5})/);
              return match ? parseInt(match[0], 10) : null;
            }

            function isOrdered(arr) {
              for (let i = 1; i < arr.length; i++) {
                const prev = extractNumber(arr[i - 1].name);
                const curr = extractNumber(arr[i].name);
                if (prev !== null && curr !== null && prev > curr) {
                  return false;
                }
              }
              return true;
            }

            if (!isOrdered(entries)) {
              console.log("Images out of order → applying natural sort...");
              entries.sort((a, b) => {
                const numA = extractNumber(a.name);
                const numB = extractNumber(b.name);
                if (numA !== null && numB !== null) {
                  return numA - numB;
                }
                return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
              });
            } else {
              console.log("Images already in order → no sort applied.");
            }

            // --- PROGRESSIVE RENDERING ---
            const totalImages = entries.length;
            let imagesLoaded = 0;
            let blobUrls = [];
            const INITIAL_LOAD = Math.min(3, totalImages);
            const PAGE_BATCH_SIZE = 5;

            // Create placeholder containers
            const imageContainers = [];
            for (let i = 0; i < totalImages; i++) {
              const container = document.createElement("div");
              container.setAttribute("data-page-index", i);
              container.style.width = "100%";
              container.style.minHeight = "600px";
              container.style.background = "#f0f0f0";
              container.style.display = "block";
              readerContainer.appendChild(container);
              imageContainers.push({ container, entry: entries[i], loaded: false, url: null });
            }

            // Render individual page
            async function renderPage(pageIndex) {
              if (pageIndex >= totalImages || imageContainers[pageIndex].loaded) return;
              const { container, entry } = imageContainers[pageIndex];
              try {
                const blob = await entry.async("blob");
                const url = URL.createObjectURL(blob);
                blobUrls.push(url);

                const imageElement = document.createElement("img");
                imageElement.src = url;
                imageElement.alt = `Page ${pageIndex + 1}`;
                imageElement.style.width = "100%";
                imageElement.style.display = "block";
                imageElement.className = "chapter-image";
                imageElement.setAttribute("data-page-index", pageIndex);

                imageElement.onload = () => {
                  imagesLoaded++;
                  if (imagesLoaded === totalImages && spinner) spinner.style.display = "none";
                };

                imageElement.onerror = (e) => {
                  console.error(`Failed to load page ${pageIndex}:`, e);
                  imageElement.src = "../assets/missing-page.jpg";
                  imagesLoaded++;
                  if (imagesLoaded === totalImages && spinner) spinner.style.display = "none";
                };

                container.innerHTML = "";
                container.appendChild(imageElement);
                imageContainers[pageIndex].loaded = true;
                imageContainers[pageIndex].url = url;
              } catch (err) {
                console.error(`Error rendering page ${pageIndex}:`, err);
                imagesLoaded++;
              }
            }

            // Load initial batch
            for (let i = 0; i < INITIAL_LOAD; i++) {
              await renderPage(i);
            }

            if (spinner) spinner.style.display = "none";

            // Lazy load with Intersection Observer
            const observer = new IntersectionObserver((entries) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  const pageIndex = parseInt(entry.target.getAttribute("data-page-index"));
                  for (let i = pageIndex; i < Math.min(pageIndex + PAGE_BATCH_SIZE, totalImages); i++) {
                    renderPage(i);
                  }
                }
              });
            }, { rootMargin: "300px" });

            imageContainers.forEach(({ container }) => {
              observer.observe(container);
            });

            document.dispatchEvent(new Event("chapterLoaded"));

            // Cleanup on unload
            window.addEventListener("beforeunload", () => {
              observer.disconnect();
              blobUrls.forEach(url => URL.revokeObjectURL(url));
            });

          } catch (err) {
            console.error("Error loading CBZ:", err);
            readerContainer.innerHTML += "<p>Failed to load Chapter.</p>";
            if (spinner) spinner.style.display = "none";
          }
        })();
      }
      const chapterKey = `chapter-${chapter.id}`;
      const scrollKey = `${chapterKey}-scroll`;
      const progressKey = `${chapterKey}-progress`;
      const comicProgressKey = `progress_${comic.id}`;

      function initProgressTracking() {
        imageElements = document.querySelectorAll(".chapter-image");

        if (!imageElements.length) {
          console.log("No images found yet, retrying...");
          setTimeout(initProgressTracking, 500);
          return;
        }

        console.log(`Found ${imageElements.length} images for tracking`);

        // Restore last scroll position
        const savedScroll = localStorage.getItem(scrollKey);
        if (savedScroll) {
          setTimeout(() => window.scrollTo(0, parseInt(savedScroll, 10)), 100);
        }

        // Restore last read progress
        const savedProgress = localStorage.getItem(progressKey);
        if (savedProgress && imageElements[savedProgress]) {
          imageElements[savedProgress].classList.add("last-read");
        }

        // Efficient progress tracking with Intersection Observer + debouncing
        let saveProgressTimeout;
        const progressObserver = new IntersectionObserver(
          (entries) => {
            clearTimeout(saveProgressTimeout);

            let currentIndex = 0;
            let maxVisibility = 0;

            entries.forEach(entry => {
              const pageIndex = parseInt(entry.target.getAttribute("data-page-index"));
              const visibility = entry.intersectionRatio;
              if (visibility > maxVisibility) {
                maxVisibility = visibility;
                currentIndex = pageIndex;
              }
            });

            // Debounce progress save
            saveProgressTimeout = setTimeout(() => {
              localStorage.setItem(scrollKey, window.scrollY);
              localStorage.setItem(progressKey, currentIndex);

              // Update comic-level progress for chapter page
              const comicProgress = {
                chapterId: chapter.id,
                pageIndex: currentIndex,
                lastRead: Date.now()
              };
              localStorage.setItem(comicProgressKey, JSON.stringify(comicProgress));

              // Update highlight
              imageElements.forEach((img, i) => {
                if (i === currentIndex) {
                  img.classList.add("last-read");
                } else {
                  img.classList.remove("last-read");
                }
              });
            }, 200);
          },
          { threshold: [0, 0.5, 1] }
        );

        imageElements.forEach(img => progressObserver.observe(img));

        // Cleanup
        window.addEventListener("beforeunload", () => {
          progressObserver.disconnect();
          clearTimeout(saveProgressTimeout);
        });
      }

      // Initialize progress tracking after images load
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