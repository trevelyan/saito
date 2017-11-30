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

  if (this.app.wallet.returnBalance() > 200) {
    var newtx = this.app.wallet.createUnsignedTransaction(this.app.wallet.returnPublicKey(), 0.0, 5.0);
    //newtx.transaction.msg.data = this.generateRandomString(10240000);
    newtx.transaction.msg.data = this.generateRandomString((1024000*4));
    newtx = this.app.wallet.signTransaction(newtx);

console.log("\n------------- CREATING TX -> from ------------");
console.log(JSON.stringify(newtx.transaction.from));
console.log("----------------------------------------------");

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

