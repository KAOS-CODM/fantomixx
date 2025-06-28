class SearchBar extends HTMLElement {
    constructor() {
      super();
      this.innerHTML = `
        <div class="search-container">
          <input type="text" placeholder="Search..." id="site-search-input" class="search-input">
          <button id="site-search-btn" class="search-button">Search</button>
        </div>
      `;
    }

    connectedCallback() {
      const input = this.querySelector("#site-search-input");
      const button = this.querySelector("#site-search-btn");

      const isComic = window.location.pathname.includes("comic");
      const isChapter = window.location.pathname.includes("chapter");
      const isGenre = window.location.pathname.includes("genre");

      const filter = () => {
        const query = input.value.trim().toLowerCase();

        if (isComic) {
          const cards = document.querySelectorAll(".comic-card-link");
          cards.forEach(card => {
            const title = card.getAttribute("data-title")?.toLowerCase() || "";
            const genre = card.getAttribute("data-genre")?.toLowerCase() || "";
            const match = title.includes(query) || genre.includes(query);
            card.style.display = match || query === "" ? "block" : "none";
          });
        }

        if (isChapter) {
          const chapters = document.querySelectorAll(".chapter-card-link");
          chapters.forEach(card => {
            const chapter = card.getAttribute("data-chapter")?.toLowerCase() || "";
            const match = chapter.includes(query);
            card.style.display = match || query === "" ? "block" : "none";
          });
        }

        if (isGenre) {
          const cards = document.querySelectorAll(".genre-card");
          cards.forEach(card => {
            const title = card.getAttribute("data-title")?.toLowerCase() || "";
            const genre = card.getAttribute("data-genre")?.toLowerCase() || "";
            const match = title.includes(query) || genre.includes(query);
            card.style.display = match || query === "" ? "block" : "none";
          });
}

      };

      input.addEventListener("input", filter);
      button.addEventListener("click", filter);
    }
  }

  customElements.define("search-bar", SearchBar);
