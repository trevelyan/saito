var saito = require('../saito');


function Block(app, blkjson="") {

  if (!(this instanceof Block)) {
    return new Block(app, blkjson);
  }

  this.app = app || {};

  ////////////////////////
  // included in blocks //
  ////////////////////////
  this.block                  = {};
  this.block.unixtime         = new Date().getTime();
  this.block.prevhash         = "";                   // hash of previous block
  this.block.roothash         = "";                   // hash of merkle tree
  this.block.miner            = "";
  this.block.id               = 1;
  this.block.maxTxId          = 0;
  this.block.transactions     = [];    // array of transactions as json


  /////////////////////////
  // consensus variables //
  /////////////////////////
  this.block.burn_fee         = 1.0;   // this should be set to network consensus levels
  this.block.difficulty       = 1.0;   // this should be set to network consensus levels
  this.block.paysplit         = 0.5;   // this should be set to network consensus levels
  this.block.coinbase         = 0;


  ////////////
  // voting //
  ////////////
  this.block.paysplit_vote    = 0;     // -1 reduce miner payout
                                       //  0 no change
                                       //  1 increase miner payout


  ////////////////////////////
  // not included in blocks //
  ////////////////////////////
  this.transactions                  = [];    // array of transaction objects
  this.confirmations                 = 0;     // number of confirmations
  this.callbacks                     = [];    // when attached
  this.callbacksTx                   = [];    // relevant index in tx array


  //////////////////////
  // create from JSON //
  //////////////////////
  if (blkjson != "") {
    this.block = JSON.parse(blkjson);
    for (i = 0; i < this.block.transactions.length; i++) {
      this.transactions[i] = new saito.transaction(this.block.transactions[i]);
    }
  }


  return this;

}
module.exports = Block;






