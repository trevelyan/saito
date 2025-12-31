module.exports = (app, mod, author, subscription = null) => {
  const isSubscribed = subscription !== null;
  const tier = (subscription && subscription.tier) || 'free';

  return `
    <div class="stack-subscription-item" data-author="${author}">
      <div class="stack-subscription-info">
        <div class="stack-subscription-author">${author.slice(0, 16)}...</div>
        <div class="stack-subscription-tier">${tier === 'paid' ? 'Paid Subscription' : 'Free Subscription'}</div>
      </div>
      <div class="stack-subscription-actions">
        ${isSubscribed ? `
          <button class="stack-btn stack-btn-secondary stack-unsubscribe-btn" data-author="${author}">
            Unsubscribe
          </button>
        ` : `
          <button class="stack-btn stack-btn-primary stack-subscribe-btn" data-author="${author}">
            Subscribe
          </button>
        `}
      </div>
    </div>
  `;
};

