module.exports = (newPost) => {
  // Injected into `.actions` — compact feed-header control.
  return `
      <button class="new-post saito-button-primary compact" type="button">
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
        <span>Post</span>
      </button>
  `;
};
