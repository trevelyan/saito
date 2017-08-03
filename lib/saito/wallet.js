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


  /////////////////////////
  // or create from JSON //
  /////////////////////////
  if (walletjson != "") {
    this.wallet = JSON.parse(walletjson);
  }

}
module.exports = Wallet;



