//
// This module monitors the blockchain and our
// unspent transaction inputs. It creates fake
// transactions to speed up block production 
// for testing purposes.`
//
var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var crypto = require('crypto');




//////////////////
// CONSTRUCTOR  //
//////////////////
function Spammer(app) {

  if (!(this instanceof Spammer)) { return new Spammer(app); }

  Spammer.super_.call(this);

  this.app             = app;
  this.name            = "Spammer";

  return this;

}
module.exports = Spammer;
util.inherits(Spammer, ModTemplate);




Spammer.prototype.onNewBlock = function onNewBlock(blk) {

  if (this.app.BROWSER == 1) { return; }

  var emails_to_send = 1000;
  var size_of_emails_in_mb = 0.03;
  var size_of_mb = 1024000;

console.log("HERE WE ARE IN SPAMMER CLASS: " + (1024000 * size_of_emails_in_mb));

  for (var x = 0; x < emails_to_send; x++) {

    var available_inputs = this.app.wallet.getAvailableInputs();

    if (available_inputs < 5.0 || (x > 0 && x >= emails_to_send-1)) { 
console.log("CREATED TXS: "+x);
      return; 
    }

    var thisfee = 0.000001;
    var thisamt = 2.0;
    var newtx;


//    if (blk.block.id < 100) { thisfee = 0.001; } 
//    if (blk.block.id < 70) { thisfee = 0.01; }
//    if (blk.block.id < 60) { thisfee = 0.012; }
//    if (blk.block.id < 50) { thisfee = 0.018; }
//    if (blk.block.id < 24) { thisfee = 0.025; }
//    if (blk.block.id < 12) { thisfee = 0.05; }
//    if (blk.block.id < 6) { thisfee = 0.1; }
//    if (blk.block.id < 5) { thisfee = 0.25; }
//    if (blk.block.id < 4) { thisfee = 0.2; }
//    if (blk.block.id < 3) { thisfee = 0.3; }
//    if (blk.block.id < 2) { thisfee = 0.4; }
    if (x == 1) { thisfee = 0.44; }
    if (x == 0) { thisfee = 1.5; }

    newtx = this.app.wallet.createUnsignedTransaction(this.app.wallet.returnPublicKey(), thisamt, thisfee);
    if (x == 0) {
      console.log("------------- CREATING TX ---------------");
    }
    var strlength = size_of_mb * size_of_emails_in_mb;
    newtx.transaction.msg.data = crypto.randomBytes(Math.ceil(strlength/2)).toString('hex').slice(0,strlength);
    newtx = this.app.wallet.signTransaction(newtx);
    this.app.blockchain.mempool.addTransaction(newtx);

  }

}


