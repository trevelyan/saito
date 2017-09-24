//
// This module monitors the blockchain and our
// unspent transaction inputs.
//
// Right now it just monitors to see how many
// transaction inputs we have and bundles them
// together occasionally to keep our wallet/
// options file from getting unwieldy.
//
var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Banker(app) {

  if (!(this instanceof Banker)) { return new Banker(app); }

  Banker.super_.call(this);

  this.app             = app;
  this.name            = "Banker";
  this.browser_active  = 0;

  this.block_activation_target        = 5;  // every X blocks, unify
  this.max_wallet_inputs              = 4;  

  return this;


}
module.exports = Banker;
util.inherits(Banker, ModTemplate);




Banker.prototype.initialize = function initialize(app) {

  if (app.wallet.wallet.utxi.length > 0) {
    this.block_activation_target = (app.wallet.wallet.utxi[0].bid + this.block_activation_target);
  } else {
    this.block_activation_target = app.blockchain.returnLatestBlockId() + this.block_activation_target;
  }

}


Banker.prototype.onNewBlock = function onNewBlock(blk) {

  if (blk.block.id > this.block_activation_target) {

    if (this.app.wallet.wallet.utxi.length > this.max_wallet_inputs) {

      var total_payment = parseFloat(0.0);

      // avoid unspendable wallets by merging half
      for (var xd = 0; xd < this.app.wallet.wallet.utxi.length/2; xd++) {
        total_payment += parseFloat(this.app.wallet.wallet.utxi[xd].amt).toFixed(8);
      }

      var fee = 2.0;
      var amount = parseFloat(total_payment) - parseFloat(fee);
          amount = amount.toFixed(8);

      if (amount <= 0) {} else {

        console.log("\n\n\nSENDING BANKER REBROADCAST: ");
        console.log(amount);
        console.log(fee);
        console.log(" from "+this.app.wallet.returnBalance());

        var newtx = blk.app.wallet.createUnsignedTransactionWithFee(blk.app.wallet.returnPublicKey(), amount, fee);
        newtx = blk.app.wallet.signTransaction(newtx);
        blk.app.network.propagateTransaction(newtx);

      }
    }
    this.block_activation_target = blk.block.id + this.block_activation_target;
  }
}

