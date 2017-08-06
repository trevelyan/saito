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
  tx.transaction.msig   = this.signMessage(JSON.stringify(tx.transaction.msg));
  tx.transaction.sig    = this.signMessage(tx.paymentSignatureSource());
  return tx;
}
Wallet.prototype.signMessage = function signMessage(message) {
  return saito.crypt().signMessage(message, this.wallet.privateKey);
}

Wallet.prototype.verifyMessage = function verifyMessage(message, sig, publicKey) {
  return saito.crypt().verifyMessage(message, sig, publicKey);
}






///////////////////////////////////////////
// Payslip (Input and Output) Management //
///////////////////////////////////////////
Wallet.prototype.addInput = function addInput(x) {
  this.wallet.utxi.push(x);
}
Wallet.prototype.getAdequateInputs = function getAdequateInputs(amount_needed) {

  var utxiset = [];
  value   = 0;

  for (i = 0; i < this.wallet.utxi.length; i++) {
    utxiset.push(this.wallet.utxi[i]);
    value += this.wallet.utxi[i].amount;
    if (value >= amount_needed) { return utxiset; }
  }

  // if we haven't found an input, create a false
  // one for testing purposes. this won't validate
  // in real life, but we can use it to at least
  // test coinbase-issuing code up until the point
  // that everything gets nailed down.
  //
  //
  badinput = new saito.slip(this.returnAddress(), (amount_needed+0.001));
  utxiset.push(badinput);

  return utxiset;

}





///////////////////////////
// Generate Transactions //
///////////////////////////
// return an empty transaction from me to me for 0.0 -- is used when padding an empty
// block, to ensure there is always one transaction available for block reward distribution
Wallet.prototype.createUnsignedTransaction = function createUnsignedTransaction(to, amt) {

  tx = new saito.transaction();

  // we could get inadequate inputs -1 if not enough money, need to deal with
  //
  // note -- inputs provided automatically as an array
  //
  // outputs are created and added manually into array
  //
  tx.transaction.from = this.getAdequateInputs(amt);
  tx.transaction.ts   = new Date().getTime();
  tx.transaction.to.push(new saito.slip(to, amt));

  return tx;

}
Wallet.prototype.createGoldenTransaction = function createGoldenTransaction(winners, mysolution) {

  tx = new saito.transaction();
  tx.transaction.from.push(new saito.slip(this.returnPublicKey(), 0.0, 1));
  tx.transaction.to.push(winners[0]);
  tx.transaction.to.push(winners[1]);
  tx.transaction.ts           = new Date().getTime();
  tx.transaction.gt           = mysolution;
  tx.transaction.msg          = "golden ticket";
  tx.transaction.msig         = this.signMessage(tx.transaction.msg);
  tx.transaction.sig          = this.signMessage(tx.paymentSignatureSource());

  return tx;

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
Wallet.prototype.returnEmptyTransaction = function returnEmptyTransaction() {
  return this.signTransaction(this.createUnsignedTransaction(this.returnAddress(), 0.0));
}




