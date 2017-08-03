var saito   = require('../saito');
var t       = require('../start');
var utils   = t.utils;




function Blockchain(app) {

  if (!(this instanceof Blockchain)) { return new Blockchain(app); }

  this.app     = app || {};

//  this.mempool = new saito.mempool(this.app);
//  this.miner   = new saito.miner(this.app);
//  this.voter   = new saito.voter(this.app, JSON.stringify(this.app.options["Voter"]));


  /////////////////////////
  // Consensus Variables //
  /////////////////////////
  this.heartbeat               =  20;       // expect new block every 20 seconds
  this.money_supply            = 21000000;  // zero-inflation target
  this.genesis_period          = 10;        // adjust the genesis hash each N blocks
  this.fork_guard              = 5;         // discard forks that fall N blocks behind


  ///////////////////
  // Longest Chain //
  ///////////////////
  this.unixtime                = new Date().getTime();
  this.maxTxId                 = 0;
  this.maxBlockId              = 0;
  this.longestChain            = 0; // position of longest chain in indices


  ////////////
  // Blocks //
  ////////////
  this.blocks                  = [];


  /////////////
  // Indexes //
  /////////////
  this.index = {
    hash:     [],                       // hashes
    prevhash: [],                       // hash of previous block
    ts:       [],                       // timestamps
    maxTxId:  [],                       // max transaction id in each block
  };



  return this;

}
module.exports = Blockchain;





////////////////
// Initialize //
////////////////
Blockchain.prototype.initialize = function initialize() {

  ///////////////////////////////////////
  // fill indexes with archived blocks //
  ///////////////////////////////////////
  this.app.storage.indexRecentBlocks(this.genesis_period+this.fork_guard);

}














//
// indexAndStore is where we take the actual block and stick
// it into our in-mempory blockchain (both the indexes and the
// queue of full-blocks.
//
// after inserting a block, this function also checks whether it
// forms the longest chain.
//
Blockchain.prototype.indexAndStore = function indexAndStore(newblock, forceAdd="no") {

  console.log("Adding "+newblock.hash()+" to index");

}







