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
function Spammer(app) {

  if (!(this instanceof Spammer)) { return new Spammer(app); }

  Spammer.super_.call(this);

  this.app             = app;
  this.name            = "Spammer";
  this.browser_active  = 0;

  return this;


}
module.exports = Spammer;
util.inherits(Spammer, ModTemplate);




Spammer.prototype.onNewBlock = function onNewBlock(blk) {

  if (this.app.wallet.returnBalance() > 200) {
    var newtx = blk.app.wallet.createUnsignedTransactionWithFee(blk.app.wallet.returnPublicKey(), 0.0, 0.5);
    newtx.transaction.msg.data = this.generateRandomString(100);;
    newtx = blk.app.wallet.signTransaction(newtx);
    this.app.blockchain.mempool.addTransaction(newtx);
  } else {
    console.log("Spammer Module: onNewBlock not adding: "+this.app.wallet.returnBalance());
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
  return(Math.floor(intFrom + ( (intTo - intFrom + 1) * Math.random((intSeed != null) ? intSeed : 0))));
}

