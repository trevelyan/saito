const ScriptingKeyOverlay = require('./scripting.js');
const FileUploadTemplate = require('./file-upload.template');
const SaitoOverlay = require('./../../../../../lib/saito/ui/saito-overlay/saito-overlay');
const SaitoNFT = require('./../../../../../lib/saito/ui/saito-nft/saito-nft');

const DEFAULT_COPY =
  'A standard Access Key provides access to the owner of the NFT. Transfer the NFT and ownership of the file transfers with it.';

const ADVANCED_COPY =
  'Advanced access keys give creators complete control over the scripts used to provide file access. Selecting this option requires familiarity with Saito Scripting. You will be prompted to provide the script that protects access to your file.';

class FileUpload {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    this.scripting_overlay = new ScriptingKeyOverlay(this.app, this.mod);
    this.nft_id = '';
    this.advanced = false;
  }

  render() {
    const isMobile =
      this.app.browser.isMobileBrowser() ||
      (typeof window !== 'undefined' && window.innerWidth <= 768);

    this.advanced = false;
    this.overlay.show(FileUploadTemplate(this.app, this.mod, isMobile));
    this.attachEvents(isMobile);
  }

  root() {
    return document.querySelector('.vault-upload-overlay');
  }

  showKeyStep() {
    const root = this.root();
    if (!root) {
      return;
    }

    const keyStep = root.querySelector('.key-step');
    const uploadStep = root.querySelector('.saito-file-drop-zone-wrap');
    if (keyStep) {
      keyStep.style.display = 'flex';
      keyStep.classList.remove('is-uploading');
    }
    if (uploadStep) {
      uploadStep.style.display = 'none';
    }

    this.applyMode();
  }

  applyMode() {
    const root = this.root();
    if (!root) {
      return;
    }

    const title = root.querySelector('.saito-overlay-form-header .saito-overlay-form-header-title');
    if (title) {
      title.textContent = this.advanced ? 'ADVANCED ACCESS KEY' : 'STANDARD KEY';
    }

    const copy = root.querySelector('[data-key-copy]');
    if (copy) {
      copy.textContent = this.advanced ? ADVANCED_COPY : DEFAULT_COPY;
    }

    const artwork = root.querySelector('.key-artwork');
    if (artwork) {
      artwork.classList.toggle('jade', !this.advanced);
      artwork.classList.toggle('crystal', this.advanced);
    }

    const toggle = root.querySelector('[data-action="toggle-mode"]');
    if (toggle) {
      toggle.innerHTML = this.advanced
        ? '<span>use default key...</span>'
        : '<span>create custom key...</span>';
    }
  }

  async ensureBalance() {
    const wallet_balance = await this.app.wallet.getBalance('SAITO');
    if (Number(wallet_balance) < 1) {
      siteMessage('Insufficient SAITO to Create Vault NFTs...', 3000);
      this.app.connection.emit('saito-purchase-launch');
      return false;
    }
    return true;
  }

  openScriptingFlow() {
    this.overlay.hide();
    this.scripting_overlay.render();
    this.scripting_overlay.callback = (obj) => {
      if (obj?.access_script) {
        this.mintNFT(obj.access_script);
      }
    };
  }

  attachEvents(openFilePicker = false) {
    const root = this.root();
    if (!root) {
      return;
    }

    const keyStep = root.querySelector('.key-step');
    const uploadStep = root.querySelector('.saito-file-drop-zone-wrap');
    if (keyStep) {
      keyStep.style.display = 'none';
    }
    if (uploadStep) {
      uploadStep.style.display = 'flex';
    }

    this.app.browser.addDragAndDropFileUploadToElement(
      'vault-file-upload',
      async (file, confirm = false, fileobj = null) => {
        try {
          if (!file && fileobj) {
            if (fileobj.size > this.app.browser.MAX_FILE_SIZE) {
              salert(`File size exceeds browser limit. Please choose a smaller file.`);
            } else {
              salert(
                `Failed to read file. File may be too large (${(fileobj.size / 1024 / 1024).toFixed(2)} MB). Try a smaller file.`
              );
            }
            return;
          }

          if (fileobj && fileobj.size > this.app.browser.MAX_FILE_SIZE) {
            salert(`File size exceeds browser limit. Please choose a smaller file.`);
            return;
          }

          if (!file || !fileobj) {
            salert('Invalid file. Please try again.');
            return;
          }

          this.mod.file = file;
          this.mod.filename = fileobj.name;
          this.advanced = false;
          this.showKeyStep();
        } catch (err) {
          console.error('Vault file upload error:', err);
          salert('Error processing file. Please try again.');
        }
      },
      true
    );

    if (openFilePicker) {
      document.querySelector('#hidden_file_element_vault-file-upload')?.click();
    }

    root.querySelector('[data-action="toggle-mode"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.advanced = !this.advanced;
      this.applyMode();
    });

    root.querySelector('[data-action="confirm-key"]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!(await this.ensureBalance())) {
        return;
      }
      if (this.advanced) {
        this.openScriptingFlow();
        return;
      }
      this.mintNFT();
    });
  }

  async mintNFT(access_script = null) {
    if (!this.mod.file) {
      alert('Please upload a file before creating an NFT.');
      return;
    }

    const depositAmt = BigInt(this.app.wallet.convertSaitoToNolan(1));
    const balance = await this.app.wallet.getBalance();
    if (balance < depositAmt) {
      alert('Insufficient funds to mint NFT');
      return;
    }

    const txmsg = {
      module: 'Vault',
      request: 'mint-vault-key',
      data: {
        link: 'https://saito.io/vault',
        filename: this.mod.filename,
        file_id: ''
      }
    };

    const nft_tx = await this.app.wallet.createMintNFTTransaction(
      BigInt(1),
      depositAmt,
      txmsg,
      BigInt(0n),
      this.app.wallet.publicKey,
      'vault-nft-key'
    );

    const nft_obj = new SaitoNFT(this.app, this.mod, nft_tx);
    this.nft_id = nft_obj.id;
    if (!this.nft_id) {
      alert('Unable to compute NFT ID for minted NFT');
      return;
    }

    siteMessage('Binding Access Key to File...', 2000);

    const file_tx = await this.mod.createVaultAddFileTransaction(this.nft_id, access_script);
    if (!file_tx) {
      alert('Error creating Vault file transaction');
      return;
    }

    // Hydrate msg from on-chain data before patching — nft_tx.msg defaults to {}
    // and sign()/packData() would otherwise overwrite data without link/module/etc.
    const msg = nft_tx.returnMessage() || {};
    if (!msg.data || typeof msg.data !== 'object') {
      msg.data = {};
    }
    msg.data.file_id = file_tx.signature;
    if (access_script != null) {
      msg.data.file_access_script = access_script;
    }
    nft_tx.msg = msg;

    siteMessage('Signing and Propagating...', 2000);
    await nft_tx.sign();
    await this.app.network.propagateTransaction(nft_tx);

    if (!this.mod.peer) {
      alert('ERROR: issue connecting to server. Please try again later.');
      return;
    }

    siteMessage('Transferring File to Archive...', 3000);
    this.root()?.querySelector('.key-step')?.classList.add('is-uploading');

    await this.app.network.sendRequestAsTransaction(
      'vault add file',
      file_tx.serialize_to_web(this.app),
      () => {
        this.overlay.hide();
        siteMessage('File Upload Successful..', 3000);

        if (!this.mod.transaction_monitor) {
          console.error('Vault: transaction_monitor is not initialized');
          return;
        }

        this.mod.transaction_monitor.render({
          tx: nft_tx,
          title: 'Upload complete',
          lead: 'Your Vault Key has been broadcast to the Saito network.',
          subtitle: 'This page will update automatically when your Vault Key is confirmed.',
          successTitle: 'Vault Key Received',
          successLead:
            'Your Vault Key has arrived. Press Continue to open My NFTs and retrieve your new Access Key.',
          successActionLabel: 'Continue',
          callback: (result) => {
            if (result?.status === 'confirmed') {
              this.app.connection.emit('vault-file-access-render');
            }
          }
        });
      }
    );
  }
}

module.exports = FileUpload;
