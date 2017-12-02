//
// This module monitors the blockchain and our
// unspent transaction inputs. It creates fake
// transactions to speed up block production 
// for testing purposes.`
//
var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


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

  var emails_to_send = 1;
  var size_of_emails_in_mb = 10;

  for (var x = 0; x < emails_to_send; x++) {

    var available_inputs = this.app.wallet.getAvailableInputs();

console.log("available inputs: "+available_inputs);

    if (available_inputs < 5.0) { return; }

    var thisfee = 5.0;
    var thisamt = 2.0;
    var newtx;

    console.log("\n------------- CREATING TX --- ------------");
/***
    if (blk.block.id < 100) { thisfee = 0.008; }
    if (blk.block.id < 70) { thisfee = 0.012; }
    if (blk.block.id < 60) { thisfee = 0.016; }
    if (blk.block.id < 50) { thisfee = 0.02; }
    if (blk.block.id < 24) { thisfee = 0.025; }
    if (blk.block.id < 12) { thisfee = 0.05; }
    if (blk.block.id < 6) { thisfee = 0.1; }
    if (blk.block.id < 5) { thisfee = 0.125; }
    if (blk.block.id < 4) { thisfee = 0.15; }
    if (blk.block.id < 3) { thisfee = 0.2; }
    if (blk.block.id < 2) { thisfee = 0.3; }
    if (blk.block.id < 1) { thisfee = 0.5; }
    if (x == 0) { thisfee = 1.5; }
***/
    newtx = this.app.wallet.createUnsignedTransaction(this.app.wallet.returnPublicKey(), thisamt, thisfee);
    newtx.transaction.msg.data = this.generateRandomString((1024000*size_of_emails_in_mb));
    newtx = this.app.wallet.signTransaction(newtx);
    this.app.blockchain.mempool.addTransaction(newtx);

  }

}


Spammer.prototype.generateRandomString = function generateRandomString(strlength) {

  var str = "";
 
  for (var i = 0 ; i < strlength; i++) {
    var v = this.randRange(65, 90, i); 
    str += String.fromCharCode(v);
  }
  
  return str;

}
Spammer.prototype.randRange = function randRange( intFrom, intTo, intSeed ) {
  intFrom = Math.floor( intFrom );
  intTo = Math.floor( intTo );
  return (Math.floor(intFrom + ( (intTo - intFrom + 1) * Math.random((intSeed != null) ? intSeed : 0))));
}

