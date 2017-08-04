var saito = require('../saito');


function Wallet(app, walletjson="") {

  if (!(this instanceof Wallet)) {
    return new Wallet(app, walletjson);
  }

  this.app     = app || {};


  ////////////////////////////
  // serialized for storage //
  ////////////////////////////
  this.wallet               = {};
  this.wallet.privateKey    = "";
  this.wallet.publicKey     = "";
  this.wallet.utxi          = [];
  this.wallet.utxo          = [];

  return this;

}
module.exports = Wallet;



////////////////
// Initialize //
////////////////
Wallet.prototype.initialize = function initialize() {

  if (this.wallet.privateKey == "") {
    if (this.app.options.wallet != null) {
      this.wallet = this.app.options.wallet;
    }
    if (this.wallet.privateKey == "") {
      this.generateKeys();
      this.app.storage.saveOptions();
    }
  }

}













//////////////////////
// Crypto Functions //
//////////////////////
Wallet.prototype.generateKeys = function generateKeys() {
  var hasher = new saito.crypt();
  this.wallet.privateKey = hasher.generateKeys();
  this.wallet.publicKey  = hasher.returnPublicKey(this.wallet.privateKey);
  this.app.storage.saveOptions();
}
Wallet.prototype.signTransaction = function signTransaction(tx) {
  tx.transaction.messagesig   = this.signMessage(JSON.stringify(tx.transaction.message));
  tx.transaction.payment.sig  = this.signMessage(tx.paymentSignatureSource());
  return tx;
}
Wallet.prototype.signMessage = function signMessage(message) {
  return trust.crypt().signMessage(message, this.wallet.privateKey);
}

Wallet.prototype.verifyMessage = function verifyMessage(message, sig, publicKey) {
  return trust.crypt().verifyMessage(message, sig, publicKey);
}






Wallet.prototype.returnAddress = function returnAddress() {
  return this.wallet.publicKey;
}
Wallet.prototype.returnPublicKey = function returnPublicKey() {
  return this.wallet.publicKey;
}
Wallet.prototype.returnPrivateKey = function returnPublicKey() {
  return this.wallet.privateKey;
}
Wallet.prototype.returnWallet = function returnWallet() {
  return this.wallet;
}
Wallet.prototype.returnWalletJson = function returnWalletJson() {
  return JSON.stringify(this.wallet);
}




