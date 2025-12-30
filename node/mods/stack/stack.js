const ModTemplate = require('../../lib/templates/modtemplate');
const SaitoHeader = require('../../lib/saito/ui/saito-header/saito-header');
const SaitoOverlay = require('../../lib/saito/ui/saito-overlay/saito-overlay');
const Transaction = require('../../lib/saito/transaction').default;
const JSON = require('json-bigint');
const path = require('path');
const HomePage = require('./index');
const StackMain = require('./lib/ui/main');
const ExploreOverlay = require('./lib/ui/overlay/explore');
const CreatePost = require('./lib/ui/create-post');

//
// Stack - Permissioned Blogging Platform
//
// An open-source alternative to Substack that allows creators to publish
// subscription-based content on the Saito network. Supports:
// - Free and paid subscriptions
// - Permissioned content access
// - Creator monetization
// - Subscriber management
//
class Stack extends ModTemplate {
  constructor(app) {
    super(app);

    this.app = app;
    this.name = 'Stack';
    this.slug = 'stack';
    this.description = 'Permissioned blogging platform - an open-source alternative to Substack';
    this.categories = 'Social Media Blogging Publishing';
    this.icon_fa = 'fa-solid fa-newspaper';

    this.social = {
      twitter: '@SaitoOfficial',
      title: 'Stack - Permissioned Blogging',
      url: 'https://saito.io/stack',
      description: 'Open-source subscription-based blogging platform',
      image: 'https://saito.tech/wp-content/uploads/2022/04/saito_card.png'
    };

    // Cache for posts and subscriptions
    this.postsCache = {
      byAuthor: new Map(),
      bySubscription: new Map(),
      allPosts: [],
      lastFetch: 0
    };

    // Transaction loading middleware
    // Track peers offering Stack service
    this.peers = {};
    // In-memory cache for fetched transactions, keyed by signature
    this.transactionCache = {};
    
    // In-memory draft state (single source of truth)
    // Ordered by last-modified DESC (most recent first)
    this.drafts = [];

    this.overlay = new SaitoOverlay(app, this);
    this.exploreOverlay = new ExploreOverlay(app, this);
    this.main = new StackMain(app, this, '.saito-container');
    this.create_post_ui = new CreatePost(app, this, '.saito-container');
    this.chooseDraftOverlay = null; // Lazy-loaded when needed
    this.header = null;

    // Callback for after post creation
    this.callbackAfterPost = null;

    this.styles = [
      '/saito/saito.css', 
      '/stack/style.css',
      '/stack/stack-main.css',
      '/stack/stack-publish-overlay.css',
      '/stack/stack-choose-draft-overlay.css',
      '/stack/stack-explore.css',
      '/stack/stack-post-teaser.css',
      '/stack/stack-create-post.css',
      '/stack/stack-view-post.css'
    ];
    this.scripts = [];

  }

  ////////////////////////////
  // Initialization        //
  ////////////////////////////
  async initialize(app) {
    await super.initialize(app);
    this.publicKey = await this.app.wallet.getPublicKey();
    
    // Load persistent local UX state
    this.load();
    
    // DEVELOPMENT ONLY: Create demo blog posts for testing
    // TODO: Remove this function call and generateDemoStackTransactions() when ready for production
    if (this.app.BROWSER) {
      // Don't await - let it run in background
      this.generateDemoStackTransactions().catch(err => {
        console.debug('Stack: Error generating demo posts:', err);
      });
    }
  }

  ////////////////////////////
  // Rendering             //
  ////////////////////////////
  async render(app) {

    if (!this.browser_active) {
      return;
    }

    this.header = new SaitoHeader(this.app, this);
    await this.header.initialize(this.app);
    this.addComponent(this.header);

    await super.render(this.app, this);

    // Discover local drafts (non-blocking, in-memory state)
    this.discoverDrafts().catch(err => {
      console.error('Stack: Error discovering drafts:', err);
    });

    // ========================================================================
    // URL ROUTING: Parse pathname and route to appropriate view
    // ========================================================================
    const pathname = window.location.pathname;
    const slug = '/' + this.slug;
    
    // Check if pathname starts with /stack
    if (pathname.startsWith(slug)) {
      // Extract path segments after /stack
      const pathAfterSlug = pathname.substring(slug.length);
      const segments = pathAfterSlug.split('/').filter(seg => seg.length > 0);
      
      if (segments.length === 1) {
        // /stack/<publicKey> - Show creator's posts in Explorer
        const publicKey = segments[0];
        await this.handleCreatorView(publicKey);
        return;
      } else if (segments.length === 2) {
        // /stack/<publicKey>/<transactionSignature> - Show specific blog post
        const publicKey = segments[0];
        const transactionSignature = segments[1];
        await this.handlePostView(publicKey, transactionSignature);
        return;
      } else if (segments.length > 2) {
        // Invalid URL - too many segments
        this.handleInvalidURL();
        return;
      }
      // segments.length === 0 means /stack (no additional path) - fall through to default
    }

    // Default: Render the main component (splash page)
    this.main.render();

  }

  ////////////////////////////
  // URL Routing Handlers  //
  ////////////////////////////
  /**
   * Handle creator view: /stack/<publicKey>
   * Shows Explorer overlay with posts from that creator
   */
  async handleCreatorView(publicKey) {
    if (!publicKey) {
      this.handleInvalidURL();
      return;
    }

    // Initialize ExploreOverlay if needed
    if (!this.exploreOverlay) {
      this.exploreOverlay = new ExploreOverlay(this.app, this);
    }

    // Show overlay immediately with loading state
    this.exploreOverlay.isLoading = true;
    this.exploreOverlay.posts = [];
    this.exploreOverlay.currentFilter = 'creator';
    this.exploreOverlay.targetPublicKey = publicKey;
    this.exploreOverlay.render();

    // Query archive for posts by this publicKey
    try {
      const posts = await new Promise((resolve) => {
        this.app.storage.loadTransactions(
          {
            field1: 'Stack',
            field2: publicKey
          },
          (txs) => {
            if (!txs || txs.length === 0) {
              resolve([]);
              return;
            }
            
            // Filter out drafts and pending posts
            // Published posts have field4 = 'stack:post' (or no field4 for legacy posts)
            // Drafts have field4 = 'stack:draft', pending have field4 = 'stack:pending'
            const publishedTxs = txs.filter(tx => {
              const field4 = tx.field4 || '';
              // Include posts with field4 = 'stack:post' or no field4 (legacy published posts)
              return field4 === 'stack:post' || field4 === '';
            });
            
            // Extract signatures from published transactions
            const signatures = publishedTxs
              .map(tx => tx.signature)
              .filter(sig => sig);
            
            // Load full transactions using loadPosts (handles cache → peers → archive)
            this.loadPosts(signatures, 0, {}, (loadedPosts) => {
              resolve(loadedPosts || []);
            });
          },
          null // Query all peers, not just localhost
        );
      });

      // Update overlay with loaded posts
      this.exploreOverlay.posts = posts;
      this.exploreOverlay.isLoading = false;
      this.exploreOverlay.updatePostsGrid();
    } catch (error) {
      console.error('Stack: Error loading creator posts:', error);
      // Show error state
      this.exploreOverlay.isLoading = false;
      this.exploreOverlay.posts = [];
      this.exploreOverlay.updatePostsGrid();
    }
  }

  /**
   * Handle blog post view: /stack/<publicKey>/<transactionSignature>
   * Shows ViewPost for the specific transaction
   */
  async handlePostView(publicKey, transactionSignature) {
    if (!publicKey || !transactionSignature) {
      this.handleInvalidURL();
      return;
    }

    // Initialize ViewPost if needed (cache for reuse)
    if (!this.viewPostComponent) {
      const ViewPost = require('./lib/ui/view-post');
      this.viewPostComponent = new ViewPost(this.app, this, '.saito-container');
    }

    // Show loading state immediately
    const container = document.querySelector('.saito-container');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; padding: 4rem 2rem;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; color: var(--saito-font-color-light); margin-bottom: 1rem;"></i>
          <p style="color: var(--saito-font-color-light); font-size: 1.6rem;">Loading blog post for you…</p>
        </div>
      `;
    }

    // Load the transaction by signature
    try {
      const tx = await this.loadPost(transactionSignature, {}, null);
      
      if (!tx) {
        // Transaction not found - show error
        if (container) {
          container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; padding: 4rem 2rem; text-align: center;">
              <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: var(--saito-font-color-light); margin-bottom: 1rem;"></i>
              <h3 style="font-size: 2rem; font-weight: 600; color: var(--saito-font-color); margin: 0 0 1rem 0;">Unable to load this blog post</h3>
              <p style="font-size: 1.6rem; color: var(--saito-font-color-light); margin: 0; max-width: 500px; line-height: 1.6;">
                The blog post you're looking for could not be found. It may have been deleted, or you may not have permission to view it.
              </p>
            </div>
          `;
        }
        return;
      }

      // Verify the transaction is from the expected publicKey (for security)
      const txPublicKey = tx.from && tx.from.length > 0 ? (tx.from[0].publicKey || tx.from[0].address) : null;
      if (txPublicKey !== publicKey) {
        console.warn('Stack: Transaction publicKey mismatch. Expected:', publicKey, 'Got:', txPublicKey);
        // Still render, but log the mismatch
      }

      // Render the post
      this.viewPostComponent.render(tx);
    } catch (error) {
      console.error('Stack: Error loading blog post:', error);
      // Show error state
      if (container) {
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; padding: 4rem 2rem; text-align: center;">
            <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: var(--saito-font-color-light); margin-bottom: 1rem;"></i>
            <h3 style="font-size: 2rem; font-weight: 600; color: var(--saito-font-color); margin: 0 0 1rem 0;">Unable to load this blog post</h3>
            <p style="font-size: 1.6rem; color: var(--saito-font-color-light); margin: 0; max-width: 500px; line-height: 1.6;">
              An error occurred while loading the blog post. Please try again later.
            </p>
          </div>
        `;
      }
    }
  }

  /**
   * Handle invalid URL - show error state
   */
  handleInvalidURL() {
    const container = document.querySelector('.saito-container');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; padding: 4rem 2rem; text-align: center;">
          <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: var(--saito-font-color-light); margin-bottom: 1rem;"></i>
          <h3 style="font-size: 2rem; font-weight: 600; color: var(--saito-font-color); margin: 0 0 1rem 0;">Invalid URL</h3>
          <p style="font-size: 1.6rem; color: var(--saito-font-color-light); margin: 0; max-width: 500px; line-height: 1.6;">
            The URL you requested is not valid. Please check the URL and try again.
          </p>
        </div>
      `;
    }
  }

  toggleSubscriptionsSidebar() {
    // Placeholder - will implement sidebar later
    console.log('Toggle subscriptions sidebar (placeholder)');
  }

  showExplorePostsOverlay() {
    // Placeholder - will implement overlay later
    console.log('Show explore posts overlay (placeholder)');
  }


  ////////////////////////////
  // Service Declaration    //
  ////////////////////////////
  /**
   * Declares Stack service to peers, following RedSquare pattern.
   * Allows peers to advertise Stack capability.
   */
  returnServices() {
    let services = [];
    if (!this.app.BROWSER || this.offerService) {
      services.push(
        this.app.network.createPeerService(null, 'stack', 'Stack Post Archive')
      );
    }
    return services;
  }

  ////////////////////////////
  // Peer Management       //
  ////////////////////////////
  /**
   * Called when a peer connects with Stack service capability.
   * Tracks peers that advertise Stack service for future use.
   * 
   * @param {Object} app - Saito application instance
   * @param {Object} peer - Peer object
   * @param {Object} service - Service object with service name
   */
  async onPeerServiceUp(app, peer, service = {}) {
    // Only track peers offering Stack service
    if (service.service === 'stack') {
      const peerKey = peer?.publicKey || 'unknown';
      this.peers[peerKey] = {
        peer: peer,
        publicKey: peerKey,
        connected: true
      };
      console.log(`Stack: Peer ${peerKey} connected with Stack service`);
    }
  }

  ////////////////////////////
  // Inter-module Communication //
  ////////////////////////////
  respondTo(type = '', obj) {
    if (type === 'saito-header') {
      let x = [];
      if (!this.browser_active) {
        x.push({
          text: 'Stack',
          icon: this.icon_fa,
          rank: 100,
          type: 'navigation',
          callback: function (app, id) {
            navigateWindow('/stack');
          }
        });
      }
      return x;
    }

    return super.respondTo(type, obj);
  }

  ////////////////////////////
  // Transaction Handling  //
  ////////////////////////////
  async onConfirmation(blk, tx, conf) {
    const txmsg = tx.returnMessage();
    
    // Check if transaction is relevant to Stack module
    if (txmsg.module !== this.name) {
      return;
    }

    // Only process initial confirmations (conf == 0)
    if (Number(conf) == 0) {
      if (txmsg.request === 'create stack post request') {
        console.log('Stack onConfirmation: createStackPost');
        await this.receiveStackPostTransaction(tx, blk);
        
        // Clean up pending drafts after successful confirmation (only for user's own posts)
        if (tx.isFrom(this.publicKey)) {
          await this.cleanupPendingDrafts();
        }
      }
      // Add other request types here as needed (update, delete, etc.)
    }
  }

  ////////////////////////////
  // Create Stack Post Transaction
  ////////////////////////////
  /**
   * Creates a new stack post transaction and propagates it to the network.
   * 
   * @param {Object} post - The post data object
   * @param {string} post.title - The title of the post (required)
   * @param {string} post.content - The content/body of the post in Markdown format (required)
   * @param {string} post.image - Base64 encoded image data (optional)
   * @param {string} post.imageUrl - URL to an external image (optional)
   * @param {Array<string>} post.tags - Array of tag strings (optional, defaults to empty array)
   * @param {number} post.timestamp - Unix timestamp in milliseconds (optional, defaults to Date.now())
   * @param {string} post.subscriptionTier - Subscription tier: 'free' or 'paid' (optional, defaults to 'free')
   * @param {string} post.excerpt - Short excerpt/summary of the post (optional)
   * @param {Function} callback - Optional callback function to execute after post is confirmed
   * 
   * @returns {Promise<Transaction>} The signed transaction object
   * 
   * Transaction message (tx.msg) structure:
   * {
   *   module: 'Stack',
   *   request: 'create stack post request',
   *   data: {
   *     type: 'stack_post',
   *     title: string,           // Post title
   *     content: string,         // Markdown content
   *     image: string,           // Base64 image data (optional)
   *     images: array,           // JSON of (Base64 image data (optional))
   *     imageUrl: string,        // External image URL (optional)
   *     tags: Array<string>,     // Array of tags
   *     timestamp: number,       // Unix timestamp
   *     subscriptionTier: string, // 'free' or 'paid'
   *     excerpt: string          // Post excerpt (optional)
   *   }
   * }
   */
  async createStackPostTransaction(
    post = {
      title: '',
      content: '',
      image: '',
      images: [] ,
      imageUrl: '',
      tags: [],
      timestamp: Date.now(),
      subscriptionTier: 'free',
      excerpt: '',
      accessLevel: 'public' // 'public' or 'private'
    },
    callback
  ) {
    try {
      // Create new transaction
      let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(this.publicKey);

      // Validate and sanitize the post data
      const data = {
        type: 'stack_post',
        title: post.title || 'Untitled',
        content: typeof post.content === 'string' ? post.content : JSON.stringify(post.content),
        images: Array.isArray(post.images) ? post.images : [], // Embedded content images array
        tags: Array.isArray(post.tags) ? post.tags : [],
        image: post.image || '', // Teaser/header image (singular, separate)
        imageUrl: post.imageUrl || '',
        timestamp: post.timestamp || Date.now(),
        subscriptionTier: post.subscriptionTier || 'free',
        excerpt: post.excerpt || ''
      };

      // ========================================================================
      // ACCESS SCRIPT GENERATION: Attach access script and hash based on mode
      // ========================================================================
      // Public mode: unrestricted access (script that always passes)
      // Private mode: NFT-restricted access (CHECKOWNNFT script)
      // Subscription mode: no script (disabled path)
      // ========================================================================
      const accessLevel = post.accessLevel || 'public';
      let access_script = null;
      let access_hash = '';

      // Check if Scripting module is available
      const scripting_mod = this.app.modules.returnModule("Scripting");
      if (scripting_mod) {
        if (accessLevel === 'public') {
          // Public mode: Create a script that permits unrestricted access
          // For public access, we use a script that always evaluates to true
          // Since there's no "always true" opcode, we use OR with a condition
          // that checks if the sender is the publisher OR not the publisher (always true)
          // However, a simpler approach: use a minimal script structure that
          // effectively allows unrestricted access by checking a condition that's
          // always true for any sender
          // 
          // Note: In practice, Archive module may handle missing access scripts
          // as public, but we attach a script here to be explicit about access mode
          access_script = {
            op: "OR",
            args: [
              {
                op: "CHECKSENDER",
                publickey: this.publicKey
              },
              {
                op: "NOT",
                args: [
                  {
                    op: "CHECKSENDER",
                    publickey: this.publicKey
                  }
                ]
              }
            ]
          };
          // This script structure: (sender == publisher) OR (sender != publisher)
          // Always evaluates to true for any sender, effectively allowing unrestricted access
          const access_script_json = JSON.stringify(access_script);
          access_hash = scripting_mod.hash(access_script_json);
          
          // Attach to transaction message
          if (!newtx.msg) {
            newtx.msg = {};
          }
          newtx.msg.access_script = access_script_json;
          newtx.msg.access_hash = access_hash;
        } else if (accessLevel === 'private') {
          // Private mode: Restrict access to NFTs issued by the publisher
          // This uses CHECKOWNNFT to verify the requester owns an NFT issued by the publisher
          // 
          // NOTE: In a full implementation, this would require:
          // 1. The publisher to have minted a subscription NFT
          // 2. The NFT ID to be known and passed here
          // 
          // For now, we use the publisher's public key as a placeholder NFT ID.
          // This is a stub - full private access requires subscription NFT infrastructure.
          // 
          // The script structure follows Vault's pattern for NFT-gated access.
          const publisherPublicKey = this.publicKey;
          
          // Create CHECKOWNNFT script (similar to Vault's createVaultAddFileTransaction pattern)
          // This script requires the requester to provide witness data (utxokeys) proving
          // they own an NFT with the specified nftid
          access_script = {
            op: "CHECKOWNNFT",
            nftid: publisherPublicKey // Placeholder - in production, this must be the actual subscription NFT ID
          };
          
          // Convert to JSON string and compute hash using Scripting module helper
          const access_script_json = JSON.stringify(access_script);
          access_hash = scripting_mod.hash(access_script_json);
          
          // Attach to transaction message (following Vault pattern: access_script and access_hash in msg)
          if (!newtx.msg) {
            newtx.msg = {};
          }
          newtx.msg.access_script = access_script_json;
          newtx.msg.access_hash = access_hash;
        }
        // Subscription mode: no script attached (disabled path)
      } else {
        console.warn('Stack: Scripting module not available - access scripts will not be attached');
        // Fail safely: continue without access scripts
      }

      // Set the transaction message
      newtx.msg = {
        ...newtx.msg,
        module: this.name,
        request: 'create stack post request',
        data: data
      };

      await newtx.sign();

      await this.app.network.propagateTransaction(newtx);
      if (callback) {
        this.callbackAfterPost = callback;
      }

      return newtx;
    } catch (error) {
      console.error('Error creating stack post transaction:', error);
      this.app.connection.emit('saito-header-update-message', {
        msg: 'Error creating stack post',
        timeout: 2000
      });
      throw error;
    }
  }

  ////////////////////////////
  // Receive Stack Post Transaction
  ////////////////////////////
  /**
   * Handles receiving and processing a stack post transaction.
   * Called automatically when a stack post transaction is confirmed on the network.
   * 
   * @param {Transaction} tx - The confirmed transaction
   * @param {Block} blk - The block containing the transaction
   */
  async receiveStackPostTransaction(tx, blk) {
    let from = tx?.from[0]?.publicKey;
    if (!from) {
      console.error('Stack: Invalid TX');
      return;
    }

    let txmsg = tx.returnMessage();

    let post = { 
      ...txmsg.data, 
      sig: tx.signature, 
      publicKey: tx.from[0].publicKey,
      timestamp: txmsg.data.timestamp || tx.timestamp,
      lastEdited: txmsg.data.timestamp || tx.timestamp
    };

    // Add to cache
    this.postsCache.allPosts.push(post);
    
    // Also cache by author
    if (!this.postsCache.byAuthor.has(from)) {
      this.postsCache.byAuthor.set(from, []);
    }
    this.postsCache.byAuthor.get(from).push(post);

    // ========================================================================
    // Save lightweight reference to app.options.stack.posts (only for user's own posts)
    // INVARIANT: app.options.stack is lightweight - no post bodies, images, or heavy data
    // ========================================================================
    if (tx.isFrom(this.publicKey)) {
      this.load();
      if (!this.app.options.stack.posts) {
        this.app.options.stack.posts = [];
      }
      
      // Store only lightweight reference (sig, publicKey, timestamp, status)
      // Full content must be loaded from archive when needed
      const lightweightPost = {
        sig: tx.signature,
        publicKey: tx.from[0].publicKey,
        timestamp: txmsg.data.timestamp || tx.timestamp,
        lastEdited: txmsg.data.timestamp || tx.timestamp,
        status: 'published' // Can be 'published', 'unpublished', etc.
      };
      
      // Check if post already exists (update) or add new
      const existingIndex = this.app.options.stack.posts.findIndex(p => p.sig === lightweightPost.sig);
      if (existingIndex >= 0) {
        // Update existing post reference
        this.app.options.stack.posts[existingIndex] = lightweightPost;
      } else {
        // Add new post reference
        this.app.options.stack.posts.push(lightweightPost);
      }
      
      this.save();
    }

    if (this.app.BROWSER) {
      if (tx.isFrom(this.publicKey)) {
        this.app.connection.emit('saito-header-update-message', { msg: '' });
        siteMessage('Stack post published', 1500);
        
        // Browser-only confirmation alert for testing
        if (this.browser_active) {
          alert("Your blog post has been received from the network.");
        }
      } else {
        siteMessage(`New stack post by ${this.app.keychain.returnUsername(from)}`, 3000);
      }
    }

    //
    // Save confirmed post transaction to local archive with field4 = "stack:post"
    //
    await this.app.storage.saveTransaction(tx, { field4: 'stack:post', preserve: 1 }, 'localhost', blk);

    if (this.callbackAfterPost) {
      this.callbackAfterPost();
      delete this.callbackAfterPost;
    }
  }

  /**
   * Clean up pending drafts after a post is confirmed
   * Deletes all transactions with field4 = "stack:pending" owned by this user from localhost archive
   */
  async cleanupPendingDrafts() {
    try {
      return new Promise((resolve) => {
        this.app.storage.loadTransactions(
          {
            field1: 'Stack',
            field2: this.publicKey, // Only clean up this user's pending drafts
            field4: 'stack:pending'
          },
          async (txs) => {
            if (!txs || txs.length === 0) {
              resolve();
              return;
            }

            // Delete all pending draft transactions
            for (const pendingTx of txs) {
              try {
                await this.app.storage.deleteTransaction(pendingTx, null, 'localhost');
              } catch (error) {
                console.error('Error deleting pending draft:', error);
              }
            }

            resolve();
          },
          'localhost'
        );
      });
    } catch (error) {
      console.error('Error cleaning up pending drafts:', error);
    }
  }

  ////////////////////////////
  // Local State Management //
  ////////////////////////////
  /**
   * Load persistent local UX state from app.options
   * Initializes app.options.stack if it doesn't exist
   * This is CLIENT-SIDE STATE ONLY - not authoritative
   * 
   * Structure:
   * app.options.stack = {
   *   posts: [ { sig, publicKey, timestamp, lastEdited, status } ],  // Lightweight references only
   *   subscriptions: [ { publicKey, addedAt } ]  // List of subscribed creator publicKeys
   * }
   */
  load() {
    if (!this.app.options.stack) {
      this.app.options.stack = {};
    }
    if (!this.app.options.stack.posts) {
      this.app.options.stack.posts = [];
    }
    if (!this.app.options.stack.subscriptions) {
      this.app.options.stack.subscriptions = [];
    }
    // Note: app.options.stack is lightweight - no post bodies, images, or heavy data
    // Full post content must be loaded from archive transactions when needed
    
    return this.app.options.stack;
  }

  ////////////////////////////
  // Subscription Management //
  ////////////////////////////
  /**
   * Add a subscription to a creator by publicKey
   * @param {string} publicKey - The creator's publicKey
   * @returns {boolean} - True if added, false if already subscribed
   */
  addSubscription(publicKey) {
    if (!publicKey || !this.app.wallet.isValidPublicKey(publicKey)) {
      return false;
    }

    this.load();
    const subscriptions = this.app.options.stack.subscriptions || [];
    
    // Check if already subscribed
    if (subscriptions.some(sub => sub.publicKey === publicKey)) {
      return false;
    }

    // Add subscription
    subscriptions.push({
      publicKey: publicKey,
      addedAt: Date.now()
    });

    this.app.options.stack.subscriptions = subscriptions;
    this.save();
    return true;
  }

  /**
   * Check if a publicKey is subscribed
   * @param {string} publicKey - The creator's publicKey
   * @returns {boolean}
   */
  isSubscribed(publicKey) {
    if (!publicKey) return false;
    this.load();
    const subscriptions = this.app.options.stack.subscriptions || [];
    return subscriptions.some(sub => sub.publicKey === publicKey);
  }

  /**
   * Get all subscribed publicKeys
   * @returns {Array<string>}
   */
  getSubscriptions() {
    this.load();
    const subscriptions = this.app.options.stack.subscriptions || [];
    return subscriptions.map(sub => sub.publicKey);
  }

  /**
   * Save persistent local UX state to app.options
   * Persists app.options.stack using app.storage.saveOptions()
   * This is CLIENT-SIDE STATE ONLY - not authoritative
   */
  save() {
    if (!this.app.options.stack) {
      this.app.options.stack = {};
    }
    this.app.storage.saveOptions();
  }

  ////////////////////////////
  // Draft & Publish State  //
  ////////////////////////////
  /**
   * Check if the user has ever published a blog post
   * Uses postsCache.byAuthor to determine if user's publicKey appears as a publisher
   * @returns {boolean} True if user has published at least one post
   */
  hasPublished() {
    if (!this.publicKey) {
      return false;
    }
    return this.postsCache.byAuthor.has(this.publicKey) && 
           this.postsCache.byAuthor.get(this.publicKey).length > 0;
  }

  /**
   * Discover all local draft transactions from the archive
   * Stores pruned representation in-memory (this.drafts)
   * Ordered by last-modified DESC (most recent first)
   * Non-blocking, can be called on render/activation
   */
  async discoverDrafts() {
    // ========================================================================
    // DIAGNOSTIC: Log entry into discoverDrafts()
    // ========================================================================
    console.log('[DIAG] discoverDrafts() ENTRY');
    
    if (!this.app.storage) {
      console.log('[DIAG] discoverDrafts() EARLY RETURN: this.app.storage is not available');
      return;
    }

    // ========================================================================
    // DIAGNOSTIC: Log query parameters
    // ========================================================================
    const queryParams = { field1: 'Stack', field4: 'stack:draft' };
    console.log('[DIAG] discoverDrafts() Query parameters:', JSON.stringify(queryParams, null, 2));
    console.log('[DIAG] discoverDrafts() Query peer: localhost');
    console.log('[DIAG] discoverDrafts() Expected match: field1="Stack" AND field4="stack:draft" AND peer="localhost"');

    return new Promise((resolve) => {
      this.app.storage.loadTransactions(
        queryParams,
        (txs) => {
          // ========================================================================
          // DIAGNOSTIC: Log raw results count
          // ========================================================================
          const rawCount = txs ? txs.length : 0;
          console.log('[DIAG] discoverDrafts() Raw results count:', rawCount);
          
          // ========================================================================
          // DIAGNOSTIC: Log field values of returned transactions for comparison
          // ========================================================================
          if (txs && txs.length > 0) {
            console.log('[DIAG] discoverDrafts() Returned transactions have the following field values:');
            txs.forEach((tx, idx) => {
              console.log(`[DIAG]   Transaction ${idx + 1}:`);
              console.log(`[DIAG]     - field1: "${tx.field1 || 'N/A'}"`);
              console.log(`[DIAG]     - field2: "${tx.field2 || 'N/A'}"`);
              console.log(`[DIAG]     - field4: "${tx.field4 || 'N/A'}"`);
              console.log(`[DIAG]     - signature: ${tx.signature || 'N/A'}`);
            });
          } else {
            console.log('[DIAG] discoverDrafts() No transactions returned - checking if ANY drafts exist with different field values...');
            
            // ========================================================================
            // DIAGNOSTIC: Try querying with just field4 to see if drafts exist with different field1
            // ========================================================================
            this.app.storage.loadTransactions(
              { field4: 'stack:draft' },
              (allDrafts) => {
                const allDraftsCount = allDrafts ? allDrafts.length : 0;
                console.log('[DIAG] discoverDrafts() Query with ONLY field4="stack:draft" found', allDraftsCount, 'transactions');
                if (allDrafts && allDraftsCount > 0) {
                  console.log('[DIAG] discoverDrafts() These drafts have the following field values:');
                  allDrafts.forEach((tx, idx) => {
                    console.log(`[DIAG]   Draft ${idx + 1}:`);
                    console.log(`[DIAG]     - field1: "${tx.field1 || 'N/A'}" (query expected "Stack")`);
                    console.log(`[DIAG]     - field2: "${tx.field2 || 'N/A'}"`);
                    console.log(`[DIAG]     - field4: "${tx.field4 || 'N/A'}" (matches)`);
                    console.log(`[DIAG]     - signature: ${tx.signature || 'N/A'}`);
                  });
                }
              },
              'localhost'
            );
          }
          
          if (!txs || txs.length === 0) {
            this.drafts = [];
            
            // Log draftCount after discovery (downgraded from diagnostic)
            console.debug('Stack: discoverDrafts() completed. draftCount = 0');
            console.log('[DIAG] discoverDrafts() EXIT: No drafts found');
            
            resolve();
            return;
          }

          // Extract pruned draft representation
          const draftList = txs.map(tx => {
            let title = 'Untitled draft';
            let lastModified = tx.timestamp || 0;

            try {
              const msg = tx.returnMessage();
              if (msg && msg.data) {
                title = msg.data.title || title;
                // Use optional.updated_at if available, otherwise timestamp
                lastModified = tx.optional?.updated_at || tx.timestamp || 0;
              }
            } catch (err) {
              // If transaction can't be parsed, use defaults
              console.warn('Stack: Error parsing draft transaction:', err);
            }

            return {
              id: tx.signature || tx.hash || null, // Transaction identifier
              title: title,
              lastModified: lastModified
            };
          });

          // Sort by lastModified DESC (most recent first)
          draftList.sort((a, b) => b.lastModified - a.lastModified);

          this.drafts = draftList;

          // ========================================================================
          // DIAGNOSTIC: Log parsed drafts added to this.mod.drafts
          // ========================================================================
          console.log('[DIAG] discoverDrafts() Parsed drafts added to this.mod.drafts:', JSON.stringify(draftList, null, 2));

          // Log draftCount after discovery (downgraded from diagnostic)
          console.debug(`Stack: discoverDrafts() completed. draftCount = ${draftList.length}`);
          console.log('[DIAG] discoverDrafts() EXIT: Drafts found and parsed');

          resolve();
        },
        'localhost'
      );
    });
  }

  /**
   * Get the list of drafts (read-only)
   * @returns {Array} Array of draft objects with {id, title, lastModified}, ordered by recency
   */
  getDrafts() {
    return this.drafts.slice(); // Return a copy to prevent mutation
  }

  /**
   * Refresh draft list from archive
   * Call this after draft save/delete/publish operations
   */
  async refreshDrafts() {
    await this.discoverDrafts();
  }

  /**
   * Delete a draft transaction by ID (signature or hash)
   * Updates both local archive and in-memory draft list
   * @param {string} draftId - Transaction signature or hash
   * @returns {Promise<boolean>} True if draft was deleted, false otherwise
   */
  async deleteDraft(draftId) {
    if (!draftId) {
      return false;
    }

    try {
      // Load the draft transaction to delete
      const tx = await this.loadDraftTransactionById(draftId);
      if (!tx) {
        console.warn('Stack: Draft transaction not found for deletion:', draftId);
        return false;
      }

      // Delete from archive
      await this.app.storage.deleteTransaction(tx, null, 'localhost');

      // Refresh in-memory draft list
      await this.refreshDrafts();

      return true;
    } catch (error) {
      console.error('Stack: Error deleting draft:', error);
      return false;
    }
  }

  /**
   * Load a draft transaction by ID (signature or hash)
   * Internal helper for draft operations
   */
  async loadDraftTransactionById(draftId) {
    return new Promise((resolve) => {
      this.app.storage.loadTransactions(
        { field1: 'Stack', field4: 'stack:draft' },
        (txs) => {
          if (!txs || txs.length === 0) {
            resolve(null);
            return;
          }

          // Find transaction by signature or hash
          const tx = txs.find(t => 
            t.signature === draftId || t.hash === draftId
          );

          resolve(tx || null);
        },
        'localhost'
      );
    });
  }

  ////////////////////////////
  // Peer Service Handling //
  ////////////////////////////
  /**
   * Handles incoming Stack service requests from peers.
   * Serves cached posts to requesting peers.
   * Follows RedSquare pattern for service request handling.
   * 
   * @param {Object} app - Saito application instance
   * @param {Transaction} tx - Request transaction from peer
   * @param {Object} peer - Peer object making the request
   * @param {Function} mycallback - Callback to send response
   * @returns {number} 1 if handled, 0 if not handled
   */
  async handlePeerTransaction(app, tx = null, peer, mycallback) {
    if (tx == null || !mycallback) {
      return 0;
    }

    const txmsg = tx.returnMessage();
    if (!txmsg || !txmsg.request) {
      return 0;
    }

    // Handle request for a single post by signature
    if (txmsg.request === 'load stack post') {
      const signature = txmsg.data?.signature;
      
      if (!signature || typeof signature !== 'string') {
        // Invalid request - respond with empty array
        mycallback([]);
        return 1;
      }

      // Check local cache first
      if (this.transactionCache[signature]) {
        const cachedTx = this.transactionCache[signature];
        // Serialize transaction for network transmission
        const serialized = cachedTx.serialize_to_web(app);
        mycallback([serialized]);
        return 1;
      }

      // Not in cache - try local archive as fallback
      // This allows servers to serve posts they've recently loaded
      this.app.storage.loadTransactions(
        { field1: 'Stack', signature: signature },
        (txs) => {
          if (Array.isArray(txs) && txs.length > 0) {
            const foundTx = txs.find(t => t.signature === signature);
            if (foundTx) {
              // Cache it for future requests
              this.transactionCache[signature] = foundTx;
              const serialized = foundTx.serialize_to_web(app);
              mycallback([serialized]);
              return;
            }
          }
          // Not found - respond with empty array (normal, not an error)
          mycallback([]);
        },
        'localhost'
      );

      return 1;
    }

    // Handle receiving a post transaction from a peer
    // This happens when a peer sends us a post they have cached
    if (txmsg.request === 'stack post transaction') {
      const serializedTx = txmsg.data?.transaction;
      
      if (!serializedTx) {
        return 0; // Not a valid Stack post transaction
      }

      try {
        // Deserialize and validate the transaction
        const receivedTx = new Transaction();
        receivedTx.deserialize_from_web(app, serializedTx);
        
        // Basic validation - ensure it's a Stack post
        const receivedMsg = receivedTx.returnMessage();
        if (receivedMsg.module !== 'Stack' || receivedMsg.data?.type !== 'stack_post') {
          return 0; // Not a Stack post, don't handle
        }

        // Cache the received transaction
        const sig = receivedTx.signature;
        if (sig) {
          this.transactionCache[sig] = receivedTx;
          console.debug(`Stack: Cached post ${sig} received from peer`);
        }

        // Do NOT re-broadcast automatically
        // Do NOT render - this is middleware only
        return 1;
      } catch (error) {
        // Invalid transaction - silently ignore (normal)
        console.debug(`Stack: Failed to deserialize peer transaction`, error);
        return 0;
      }
    }

    // Not a Stack service request
    return 0;
  }

  ////////////////////////////
  // Transaction Loading   //
  ////////////////////////////
  /**
   * Loads a single transaction by signature.
   * Checks cache first, then queries peers, then falls back to archive.
   * Supports both callback and Promise/await usage.
   * 
   * @param {string} signature - Transaction signature to load
   * @param {Object} options - Optional parameters. Can include `peer` (object or "localhost")
   * @param {Function} callback - Optional callback function(tx)
   * @returns {Transaction|null} Transaction object if no callback, null if not found
   */
  async loadPost(signature, options = {}, callback = null) {
    // Extract peer from options if provided
    const peer = options?.peer || null;

    // Validate signature
    if (!signature || typeof signature !== 'string') {
      if (callback) {
        callback(null);
        return;
      }
      return null;
    }

    // Step 1: Check cache first
    if (this.transactionCache[signature]) {
      const cachedTx = this.transactionCache[signature];
      if (callback) {
        callback(cachedTx);
        return;
      }
      return cachedTx;
    }

    // Step 2: If peer is provided, use it directly (skip localhost check and peer queries)
    if (peer) {
      // Determine peer string for loadTransactions
      // Can be "localhost" string or a peer object (we'll use its identifier)
      let peerString = peer;
      if (typeof peer === 'object' && peer !== null) {
        // If it's a peer object, extract identifier (publicKey, address, or use object itself)
        // loadTransactions may accept the object directly, but we'll try to get a string identifier
        peerString = peer.publicKey || peer.address || peer;
      }

      return new Promise((resolve) => {
        this.app.storage.loadTransactions(
          { field1: 'Stack', signature: signature },
          (txs) => {
            let tx = null;

            // Find matching transaction
            if (Array.isArray(txs) && txs.length > 0) {
              tx = txs.find(t => t.signature === signature);
            }

            // Cache if found
            if (tx) {
              this.transactionCache[signature] = tx;
            }

            // Handle callback or Promise
            if (callback) {
              callback(tx);
              resolve(tx);
            } else {
              resolve(tx);
            }
          },
          peerString // Use provided peer (can be "localhost" or peer identifier)
        );
      });
    }

    // Step 3: Check localhost archive (if no peer specified)
    // This checks our own local archive before making network requests
    const localTx = await new Promise((resolve) => {
      this.app.storage.loadTransactions(
        { field1: 'Stack', signature: signature },
        (txs) => {
          let tx = null;

          // Find matching transaction
          if (Array.isArray(txs) && txs.length > 0) {
            tx = txs.find(t => t.signature === signature);
          }

          // Cache if found
          if (tx) {
            this.transactionCache[signature] = tx;
          }

          resolve(tx);
        },
        'localhost' // Specify localhost as peer to check local archive
      );
    });

    // If found in local archive, return it
    if (localTx) {
      if (callback) {
        callback(localTx);
        return;
      }
      return localTx;
    }

    // Step 4: Query connected Stack peers (if localhost didn't have it)
    // Simple sequential query - try first available peer
    // No racing, no retries, no timeouts (as per requirements)
    const peerKeys = Object.keys(this.peers);
    if (peerKeys.length > 0) {
      const firstPeerKey = peerKeys[0];
      const peerObj = this.peers[firstPeerKey]?.peer;
      
      if (peerObj && peerObj.peerIndex !== undefined) {
        try {
          const peerTx = await new Promise((resolve) => {
            // Query peer for the post
            this.app.network.sendRequestAsTransaction(
              'load stack post',
              { signature: signature },
              (response) => {
                // Response is array of serialized transactions
                if (Array.isArray(response) && response.length > 0) {
                  try {
                    const tx = new Transaction();
                    tx.deserialize_from_web(this.app, response[0]);
                    
                    // Validate it's the transaction we requested
                    if (tx.signature === signature) {
                      // Cache it
                      this.transactionCache[signature] = tx;
                      resolve(tx);
                      return;
                    }
                  } catch (error) {
                    console.debug(`Stack.loadPost: Failed to deserialize peer response`, error);
                  }
                }
                // Peer didn't have it or returned invalid data - resolve null
                resolve(null);
              },
              peerObj.peerIndex
            );
          });

          // If peer returned valid transaction, return it
          if (peerTx) {
            if (callback) {
              callback(peerTx);
              return;
            }
            return peerTx;
          }
          // If peer returned null, return null (no further fallback)
        } catch (error) {
          // Peer query failed - silently return null (normal)
          console.debug(`Stack.loadPost: Peer query failed`, error);
        }
      }
    }

    // Not found in cache, localhost, or peers - return null
    if (callback) {
      callback(null);
      return;
    }
    return null;
  }

  /**
   * Loads multiple transactions by their signatures.
   * Iterates through keys starting at index, preserving order.
   * Skips null results (missing transactions are normal).
   * Supports both callback and Promise/await usage.
   * 
   * @param {Array<string>} keys - Array of transaction signatures
   * @param {number} index - Starting index in keys array (default: 0)
   * @param {Object} options - Optional parameters (reserved for future use)
   * @param {Function} callback - Optional callback function(array)
   * @returns {Array<Transaction>} Array of Transaction objects (no nulls)
   */
  async loadPosts(keys, index = 0, options = {}, callback = null) {
    // Validate inputs
    if (!Array.isArray(keys) || keys.length === 0) {
      if (callback) {
        callback([]);
        return;
      }
      return [];
    }

    // Ensure index is valid
    if (index < 0) index = 0;
    if (index >= keys.length) {
      if (callback) {
        callback([]);
        return;
      }
      return [];
    }

    // Collect results, preserving order
    const results = [];
    const signaturesToLoad = keys.slice(index);

    // Load each transaction sequentially to preserve order
    for (const signature of signaturesToLoad) {
      try {
        const tx = await this.loadPost(signature, options);
        if (tx) {
          results.push(tx);
        }
        // Skip nulls silently - missing transactions are normal
      } catch (error) {
        // Silently skip errors - permission failures are normal
        console.debug(`Stack.loadPosts: Failed to load ${signature}`, error);
      }
    }

    // Handle callback or return
    if (callback) {
      callback(results);
      return results;
    }

    return results;
  }

  ////////////////////////////
  // Web Server            //
  ////////////////////////////
  webServer(app, expressapp, express, alternative_slug = null) {
    const mod_self = this;
    const webdir = path.resolve(__dirname, '../../mods', this.dirname, 'web');
    const uri = alternative_slug || '/' + encodeURI(this.returnSlug());
    
    // Main Application Route - Serves the HTML Shell generated by index.js
    expressapp.get(uri, async function (req, res) {
      let reqBaseURL = req.protocol + '://' + req.headers.host + '/';
      let updatedSocial = Object.assign({}, mod_self.social);
      updatedSocial.url = reqBaseURL + encodeURI(mod_self.returnSlug());

      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.send(HomePage(app, mod_self, app.build_number, updatedSocial, []));
    });

    // Serve static files (CSS, JS, images, etc.)
    // Use path.resolve to ensure absolute path for Express static middleware
    expressapp.use(uri, express.static(webdir));
  }

  ////////////////////////////
  // DEVELOPMENT ONLY: Demo Transactions
  ////////////////////////////
  /**
   * Generates synthetic blog post transactions for development/testing.
   * These transactions exist only in memory and are not persisted to disk.
   * 
   * TODO: Remove this function and its call in initialize() when ready for production.
   * 
   * This function:
   * - Creates 3 Transaction objects with realistic blog content
   * - Inserts them into transactionCache and postsCache
   * - Makes them discoverable by loadPost/loadPosts
   */
  async generateDemoStackTransactions() {
    if (!this.publicKey) {
      console.debug('Stack: Cannot generate demo posts without publicKey');
      return;
    }

    const demoPosts = [
      {
        title: 'On Shared Dreaming',
        subtitle: 'Exploring the architecture of collective consciousness',
        text: `# On Shared Dreaming

The idea of shared dreaming has haunted human imagination for as long as we have told stories. What happens when we build worlds together, not just in our minds, but in spaces we can enter together? The question touches on something fundamental about how we construct reality and trust one another within it.

## The Architecture of Collective Consciousness

When we dream alone, the rules are simple: everything we encounter is a product of our own mind. The physics, the logic, the people—all of it exists because we believe it does. But what if someone else could enter that space? What if the dream had to accommodate not just one consciousness, but two, or many?

The first challenge is coordination. In a private dream, you can change the rules on a whim. A door that was locked can suddenly be open because you willed it. But in a shared space, such changes require consensus, or at least acknowledgment. The shared dream becomes a negotiation, a collaborative construction where each participant brings their own expectations and limitations.

This negotiation is not just about what is possible, but about what is real. In your own dream, you know—or at least believe—that everything you see is a projection. But when another person enters, their presence introduces a fundamental uncertainty: are they real, or are they another projection? The question of authenticity becomes central, and trust becomes the currency of the shared space.

## Trust and Coordination Inside a Dream

Trust in a shared dream operates differently than trust in waking life. In the physical world, we have external referents—we can touch, measure, verify. But in a dream, verification is circular. If I ask you to prove you're real, and you respond, how do I know your response isn't just my mind creating what I expect to hear?

The answer, perhaps, is that trust in a shared dream is not about verification, but about surrender. To enter someone else's dream is to accept, at least provisionally, that their reality is as valid as your own. It is to agree to play by rules you did not create, to see things you did not imagine, to experience perspectives that are genuinely other.

This surrender is not passive. It requires active participation in the construction of the shared space. You must contribute your own elements, your own rules, your own understanding. The dream becomes a collaborative work, constantly being rewritten by all participants.

## The Difference Between Private and Collective Experience

A private dream is a monologue. A shared dream is a dialogue, or perhaps a polyphonic composition where multiple voices speak simultaneously, sometimes in harmony, sometimes in tension.

In a private dream, you are both the author and the audience. You know the plot because you wrote it, even if you don't remember writing it. But in a shared dream, you are only one of the authors, and you are constantly surprised by what the others create. The experience becomes genuinely collaborative, genuinely unpredictable.

This unpredictability is both the risk and the reward. In a private dream, you can control everything, but you can also be trapped by your own limitations. In a shared dream, you lose control, but you gain access to perspectives and possibilities you could never have imagined alone.

## The Boundaries of Shared Space

The question of boundaries becomes crucial. Where does one person's dream end and another's begin? If we are truly sharing a space, then the boundaries must be permeable, or perhaps non-existent. But if there are no boundaries, how do we maintain our individual identity? How do we know where we end and the other begins?

Perhaps the answer is that in a truly shared dream, identity itself becomes fluid. You are not just yourself, but also part of the collective construction. Your thoughts influence the space, and the space influences your thoughts. The distinction between self and other, between internal and external, begins to blur.

This blurring is not necessarily a loss. It can be an expansion, a way of experiencing consciousness that transcends individual boundaries. But it also requires a kind of courage—the willingness to let go of the certainty that comes with being the sole author of your reality.

## The Ethics of Shared Dreaming

If we can truly share dreams, then we must consider the ethics of such sharing. What are the responsibilities of the dream architect? What are the rights of the dream participant? Can someone be harmed in a shared dream? Can they be healed?

These questions are not just theoretical. They touch on fundamental issues of consent, agency, and the nature of experience itself. If a shared dream feels real, does that make it real? And if it is real, what obligations do we have to those who share it with us?

The answer may be that shared dreaming, like any form of shared experience, requires mutual respect and care. We must enter each other's spaces with intention, with awareness of the power we have to shape the experience, and with respect for the autonomy of others.

## Conclusion: The Promise of Shared Spaces

Shared dreaming, whether literal or metaphorical, represents a profound possibility: that we can construct realities together, that we can experience consciousness not just individually but collectively. This possibility challenges our assumptions about the boundaries of self and other, about what is real and what is imagined.

In the end, perhaps the question is not whether shared dreaming is possible, but whether we are willing to take the risk of entering spaces we did not create, of trusting others with the architecture of our experience, of surrendering control in exchange for the possibility of genuine collaboration.

The shared dream, then, becomes a metaphor for all forms of collective construction—for art, for community, for the ways we build worlds together in waking life. And in that sense, we are all already shared dreamers, architects of spaces we enter together, constantly negotiating the rules, the boundaries, and the meaning of what we create.`,
        imageUrl: '/saito/img/dreamscape.png',
        timestamp: Date.now() - 86400000 * 3, // 3 days ago
        url: window.location.href + '#post/shared-dreaming'
      },
      {
        title: 'Getting Started with Saito Stack',
        subtitle: 'Learn how to create your first post, set up subscriptions, and build your audience on the decentralized web.',
        text: `# Getting Started with Saito Stack

Welcome to Saito Stack, a permissioned blogging platform built on the decentralized Saito network. This guide will help you create your first post and understand the core concepts.

## Creating Your First Post

To create a post, click the "Start Writing" button in the main interface. You'll be taken to the editor where you can:

- Write your content using Markdown
- Add a feature image
- Set a title and subtitle
- Configure subscription tiers

## Understanding Subscriptions

Saito Stack supports both free and paid subscriptions. You can:

- Offer free content to build your audience
- Create premium content behind a paywall
- Manage subscriber access and permissions

## Building Your Audience

The Explore feature lets readers discover your content. Make sure to:

- Write engaging titles and subtitles
- Use clear, readable formatting
- Add compelling feature images
- Publish regularly to keep readers engaged

## Next Steps

Once you've published your first post, you can:

- Share it with your network
- Build on existing posts (fork functionality)
- Engage with your readers
- Monetize your content through subscriptions

Happy writing!`,
        imageUrl: '/saito/img/dreamscape.png',
        timestamp: Date.now() - 86400000 * 2, // 2 days ago
        url: window.location.href + '#post/demo-getting-started'
      },
      {
        title: 'Understanding Peer-to-Peer Publishing',
        subtitle: 'Unlike traditional blogging platforms, Saito Stack runs on a peer-to-peer network.',
        text: `# Understanding Peer-to-Peer Publishing

Unlike traditional blogging platforms, Saito Stack runs on a peer-to-peer network. Your posts are stored across the network, giving you true ownership and control over your content.

## The Decentralized Advantage

Traditional platforms store your content on centralized servers. This means:

- You don't own your content
- Platforms can censor or remove posts
- You're dependent on a single service
- Your data is vulnerable to breaches

With Saito Stack, your content is:

- Stored across the network
- Truly owned by you
- Resistant to censorship
- Accessible from any peer

## How It Works

When you publish a post:

1. Your transaction is created and signed
2. It's propagated across the Saito network
3. Peers cache and serve your content
4. Readers can access it from any peer

## Network Resilience

The peer-to-peer architecture means:

- No single point of failure
- Content remains available even if some peers go offline
- Fast access through local caching
- True decentralization

## Your Content, Your Control

With Saito Stack, you maintain full control over your content. No platform can:

- Delete your posts
- Modify your content
- Restrict your access
- Take ownership of your work

This is the future of publishing.`,
        imageUrl: '/saito/img/dreamscape.png',
        timestamp: Date.now() - 86400000 * 5, // 5 days ago
        url: window.location.href + '#post/demo-peer-to-peer'
      },
      {
        title: 'Advanced Monetization Strategies',
        subtitle: 'This premium content explores advanced techniques for monetizing your writing through NFT subscriptions.',
        text: `# Advanced Monetization Strategies

This premium content explores advanced techniques for monetizing your writing through NFT subscriptions, custom access rules, and building sustainable revenue streams.

## Subscription Tiers

Saito Stack supports multiple subscription models:

### Free Tier
- Build your audience
- Establish credibility
- Create a content library
- Attract subscribers

### Paid Tier
- Generate revenue
- Offer exclusive content
- Reward loyal readers
- Build a sustainable business

## Setting Up Subscriptions

To monetize your content:

1. Define your subscription tiers
2. Set pricing for each tier
3. Create premium content
4. Market to your audience

## Access Control

Control who can access your content:

- Free posts: Available to everyone
- Subscriber-only: Requires active subscription
- Premium: Higher-tier subscribers only
- Custom: Define your own access rules

## Building Revenue

Successful monetization requires:

- Consistent, high-quality content
- Clear value proposition
- Engaged community
- Strategic pricing

## Best Practices

- Start with free content to build trust
- Gradually introduce paid tiers
- Offer exclusive benefits to subscribers
- Engage with your community regularly

Remember: The best monetization strategy is one that provides genuine value to your readers.`,
        imageUrl: '/saito/img/dreamscape.png',
        timestamp: Date.now() - 86400000 * 7, // 7 days ago
        url: window.location.href + '#post/demo-monetization'
      }
    ];

    // Create and cache each demo transaction
    // Use for...of loop to properly handle async operations
    for (let index = 0; index < demoPosts.length; index++) {
      const postData = demoPosts[index];
      try {
        // Create a new transaction
        const tx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(this.publicKey);
        
        // Set transaction message with blog post data
        tx.msg = {
          module: this.name,
          request: 'create stack post request',
          data: {
            type: 'stack_post',
            title: postData.title,
            subtitle: postData.subtitle || '',
            text: postData.text, // Use 'text' field for body content
            content: postData.text, // Also set content for compatibility
            image: '',
            imageUrl: postData.imageUrl || '',
            images: [],
            url: postData.url || '',
            tags: [],
            timestamp: postData.timestamp || Date.now(),
            subscriptionTier: 'free',
            excerpt: postData.subtitle || ''
          }
        };

        // Sign the transaction
        await tx.sign();

        // Add to transactionCache (keyed by signature)
        const signature = tx.signature;
        if (signature) {
          this.transactionCache[signature] = tx;
        }

        // Add to postsCache (for Explorer discovery)
        const from = tx.from && tx.from.length > 0 ? tx.from[0].publicKey : this.publicKey;
        const txmsg = tx.returnMessage();
        const post = {
          ...txmsg.data,
          sig: signature,
          publicKey: from,
          timestamp: txmsg.data.timestamp || tx.timestamp,
          lastEdited: txmsg.data.timestamp || tx.timestamp
        };

        // Add to allPosts
        this.postsCache.allPosts.push(post);

        // Add to byAuthor cache
        if (!this.postsCache.byAuthor.has(from)) {
          this.postsCache.byAuthor.set(from, []);
        }
        this.postsCache.byAuthor.get(from).push(post);

        console.debug(`Stack: Generated demo post "${postData.title}" (${signature.substring(0, 16)}...)`);
      } catch (error) {
        console.error(`Stack: Failed to generate demo post ${index + 1}:`, error);
      }
    }
  }
}

module.exports = Stack;

