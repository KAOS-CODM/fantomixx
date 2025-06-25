document.addEventListener("DOMContentLoaded", () => {
  const navContainer = document.getElementById("dynamic-nav");

  fetch(`${API_BASE_URL}/nav`)
    .then(res => res.json())
    .then(navItems => {
      const logo = `<div class="nav-logo">🧿 FANTOMIXX</div>`;
      let linksHTML = '<ul class="nav-links">';

      navItems.forEach(item => {
        if (item.dropdown) {
          linksHTML += `
            <li class="dropdown">
              <a href="#">${item.icon || ''} ${item.label} ▾</a>
              <ul class="dropdown-menu">
                ${item.dropdown.map(sub => `<li><a href="${sub.link}">${sub.label}</a></li>`).join("")}
              </ul>
            </li>
          `;
        } else {
          linksHTML += `<li><a href="${item.link}">${item.icon || ''} ${item.label}</a></li>`;
        }
      });

      linksHTML += '</ul>';
      navContainer.innerHTML = logo + linksHTML;
    })
    .catch(err => {
      console.error("Failed to load nav.json", err);
      navContainer.innerHTML = "<p>Error loading navigation.</p>";
    });
});
