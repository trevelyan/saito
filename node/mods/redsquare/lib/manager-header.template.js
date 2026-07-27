module.exports = () => {
  // Optional Manager chrome — mounted only when the active view requires it.
  return `
      <header class="header">
        <div class="start">
          <button
            type="button"
            class="back saito-button-square"
            aria-label="Back"
            hidden
          >
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
          </button>
          <h2 class="title">Home</h2>
        </div>
        <div class="actions">
          <button class="new-post saito-button-primary compact" type="button">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
            <span>Post</span>
          </button>
        </div>
      </header>
  `;
};
