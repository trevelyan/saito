var saito   = require('../saito');
var t       = require('../start');
var utils   = t.utils;




function Blockchain(app) {

  if (!(this instanceof Blockchain)) { return new Blockchain(app); }

  this.app     = app || {};

  this.mempool = new saito.mempool(this.app);
  this.miner   = new saito.miner(this.app);
  this.voter   = new saito.voter(this.app, JSON.stringify(this.app.options["Voter"]));


  /////////////////////////
  // Consensus Variables //
  /////////////////////////
  this.heartbeat               =  20;       // expect new block every 20 seconds
  this.money_supply            = 21000000;  // zero-inflation target
  this.genesis_period          = 10;        // adjust the genesis hash each N blocks
  this.genesis_fork_guard      = 5;         // discard forks that fall N blocks behind


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



  ///////////////////////////////////////////////////////
  // fill our fast indexes with archived block storage //
  ///////////////////////////////////////////////////////
  //this.app.storage.indexRecentBlocks(this.genesis.period+this.genesis.fork_guard);

  return this;

}
module.exports = Blockchain;



