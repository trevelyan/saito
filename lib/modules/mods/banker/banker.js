//
// This module monitors the blockchain and our
// unspent transaction inputs and periodically
// resends us our money in ordr to try and keep
// it active.
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


  // earliest txinput
  this.utxi_blkid           = -1;
  this.rebroadcast_fee      = 2;
  this.target_blkid         = -1;
  this.genesis_percent      = 0.8; // when to start resending
  this.wallet_target        = 1000;  // every X blocks, unify
  this.monitor_blkid        = 1500;  
  this.monitor_blkid_max    = 1500;  // every X blocks, resend once old
				     // with 1500 blocks is about once a 
				     // day.

  this.wallet_target        = 4;  // every X blocks, unify
  this.monitor_blkid        = 4;  
  this.monitor_blkid_max    = 4;  // every X blocks, resend once old
  this.genesis_percent      = 0.0001; // when to start resending
  return this;


}
module.exports = Banker;
util.inherits(Banker, ModTemplate);




Banker.prototype.initialize = function initialize(app) {

  if (app.wallet.wallet.utxi.length > 0) {
    this.utxi_blkid   = app.wallet.wallet.utxi[0].bid;
    this.target_blkid = Math.floor(app.blockchain.genesis_period * this.genesis_percent); 
    this.wallet_target += (this.utxi_blkid%this.wallet_target);
  }

}


Banker.prototype.onNewBlock = function onNewBlock(blk) {

console.log("BANKER ON BLOCK: "+this.monitor_blkid + " -- " + this.monitor_blkid_max + " -- " + blk.block.id + " -- " + this.utxi_blkid + " -- " + this.target_blkid);

  // monitor UXTI for 1500 blocks
  // after we try to send a payment
  // we will try to resend after 1500 blocks
  // if the blockID of the first transaction is
  // still unchanged.
  if (this.monitor_blkid < this.monitor_blkid_max) {
    this.utxi_blkid   = blk.app.wallet.wallet.utxi[0].bid;
    this.monitor_blkid++;
  }



  // periodically rebroadcast payments before they fall off the 
  // blockchain. Pay a 2 SAITO fee so that blocks are issued 
  // reasonably quickly.
  if (blk.block.id > this.target_blkid && this.monitor_blkid >= this.monitor_blkid_max) {

    var amount = blk.app.wallet.returnBalance();

    if (amount > this.rebroadcast_fee) {
      var fee    = this.rebroadcast_fee;
      amount    -= this.rebroadcast_fee;

console.log("\n\n\n\n");
console.log("\n\n\nSENDING BANKER REBROADCAST: ");
console.log(amount);
console.log(fee);

      newtx = blk.app.wallet.createUnsignedTransactionWithFee(blk.app.wallet.returnPublicKey(), amount, fee);
      newtx = blk.app.wallet.signTransaction(newtx);
      blk.app.network.propagateTransaction(newtx);


      this.monitor_blkid = 0;
    }
  }


  // check to see if we have too many transactions
  // and should unify them to simplify our wallet
  if (blk.block.id % this.wallet_target == 0) {

    if (blk.app.wallet.wallet.utxi.length > 20) {
      var amount = blk.app.wallet.returnBalance();

      if (amount > this.rebroadcast_fee) {
        var fee    = this.rebroadcast_fee;
        amount    -= this.rebroadcast_fee;

        newtx = blk.app.wallet.createUnsignedTransactionWithFee(blk.app.wallet.returnPublicKey(), amount, fee);
        newtx = blk.app.wallet.signTransaction(newtx);
        blk.app.network.propagateTransaction(newtx);

console.log("\n\n\nSENDING BANKER UNIFICATION: ");

        this.monitor_blkid = 0;
      }
    }
  }




}


