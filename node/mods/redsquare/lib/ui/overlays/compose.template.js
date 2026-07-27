const TweetTemplate = require('../../tweet.template');
const TweetHeaderTemplate = require('../../tweet-header.template');

module.exports = (compose) => {
  const mode = compose.mode || 'post';
  const ariaLabel = mode === 'retweet' ? 'Retweet' : mode === 'reply' ? 'Reply' : 'Compose post';
  const submitLabel = mode === 'retweet' ? 'Retweet' : mode === 'reply' ? 'Reply' : 'Post';

  let replyPreview = '';

  if (compose.reply_to) {
    const tweet = compose.reply_to;
    const className =
      typeof tweet.buildClassName === 'function'
        ? tweet.buildClassName({ presentation: 'focused', focused: true })
        : 'tweet focused';

    replyPreview = `
      <div class="reply-preview">
        ${TweetTemplate(tweet, className, {
          presentation: 'focused',
          focused: true
        })}
      </div>
    `;
  }

  const authorHeader = TweetHeaderTemplate({
    presentation: 'compose',
    name: compose.display_name,
    secondary: compose.helper_text
  });

  return `
    <div class="compose ${mode}" id="${compose.overlay_id}" aria-label="${ariaLabel}">
      <div class="body">
        ${replyPreview}

        <div class="composer">
          <img class="avatar saito-identicon" src="${compose.avatar}" alt="" />
          <div class="main">
            ${authorHeader}

            <div class="surface" id="redsquare-compose-surface">
              <textarea
                class="input"
                placeholder="${compose.placeholder}"
                rows="4"
                maxlength="${compose.char_limit}"
              ></textarea>

              <div class="compose-picker emoji-picker-panel" aria-hidden="true">
                <div class="compose-picker-header">
                  <span>Choose Emoji</span>
                  <button
                    class="compose-picker-close"
                    type="button"
                    aria-label="Close emoji picker"
                  >
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div class="emoji-picker-host">
                  <emoji-picker class="compose-emoji-picker"></emoji-picker>
                </div>
              </div>

              <div class="compose-picker gif-picker-panel" aria-hidden="true">
                <div class="compose-picker-header">
                  <span>Choose GIF</span>
                  <button
                    class="compose-picker-close"
                    type="button"
                    aria-label="Close GIF picker"
                  >
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div class="gif-picker-content"></div>
              </div>

              <div class="image-preview"></div>
            </div>
          </div>
        </div>
      </div>

      <footer class="footer">
        <div class="tools saito-menu-select-subtle">
          <div class="tool emoji" role="button" tabindex="0" title="Add emoji">
            <i class="fa-regular fa-face-smile"></i>
          </div>
          <div class="tool image" role="button" tabindex="0" title="Add image">
            <i class="fa-regular fa-image"></i>
          </div>
          <div class="tool gif" role="button" tabindex="0" title="Add GIF">
            <i class="fa-solid fa-photo-film"></i>
          </div>
        </div>

        <div class="actions">
          <div class="char-count" aria-live="polite">
            <span class="current">0</span>
            <span class="separator">/</span>
            <span class="max">${compose.char_limit}</span>
          </div>

          <button class="submit saito-button-primary compact" type="button">
            <span class="label">${submitLabel}</span>
            <span class="spinner" aria-hidden="true"></span>
          </button>
        </div>
      </footer>

      <div class="posting-screen" aria-hidden="true">
        <div class="posting-loader">
          <div class="saito-loader"></div>
        </div>
        <p class="posting-message">${mode === 'retweet' ? 'Retweeting…' : 'Posting…'}</p>
      </div>

      <input
        class="file-input treated"
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        hidden
      />
    </div>
  `;
};
