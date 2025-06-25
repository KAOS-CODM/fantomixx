class SiteLogo extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<img src="data/logo.webp" alt="Fantomixx Logo" class="site-logo">`;
  }
}
customElements.define("site-logo", SiteLogo);
