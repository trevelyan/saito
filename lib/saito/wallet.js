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
    this.wallet = JSON.parse(this.app.options.wallet);
    if (this.wallet.privateKey == "") {
      this.generateKeys();
      this.app.storage.saveOptions();
    }
  }

  console.log("Wallet is: ");
  console.log(this.wallet);
}




Wallet.prototype.returnJson = function returnJson() {
  return JSON.stringify(this.wallet);
}
///////////////////
// Generate Keys //
///////////////////
Wallet.prototype.generateKeys = function generateKeys() {
  var hasher = new saito.crypt();
  this.wallet.privateKey = hasher.generateKeys();
  this.wallet.publicKey  = hasher.returnPublicKey(this.wallet.privateKey);
  this.app.storage.saveOptions();
}


