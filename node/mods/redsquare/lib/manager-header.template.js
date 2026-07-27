module.exports = () => {
  // Optional Manager chrome — navigation only (back + title). Creation lives in Create.
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
      </header>
  `;
};
