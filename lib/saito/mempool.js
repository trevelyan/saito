var saito = require('../saito');


function Mempool(app) {

  if (!(this instanceof Mempool)) {
    return new Mempool(app);
  }

  this.app                      = app || {};

  /////////////
  // mempool //
  /////////////
  this.transactions             = []; // array
  this.blocks                   = []; // queue


  ///////////////////////
  // processing blocks //
  ///////////////////////
  this.processing_blocks        = 0;
  this.processing_timer         = null;
  this.processing_speed         = 200; // 0.2 seconds


  ///////////////////////////
  // bundling transactions //
  ///////////////////////////
  this.bundling_blocks          = 0;
  this.bundling_timer           = null;
  this.bundling_speed           = 350; // 0.5 seconds
  this.processing_bundle        = 0;

  return this;

}
module.exports = Mempool;





/////////////////////////////////////////////////
// Adding and Removing Blocka and Transactions //
/////////////////////////////////////////////////
Mempool.prototype.addTransaction = function addTransaction(tx) {
  this.transactions.push(tx);
}
Mempool.prototype.importTransaction = function importTransaction(txjson) {
  tx = new saito.transaction(txjson);
  this.addTransaction(tx);
}
Mempool.prototype.addBlock = function addBlock(blk) {

  // check to see if this block already exists in our mempool
  for (i = 0; i < this.blocks.length; i++) {
    if (this.blocks[i].hash() == blk.hash()) {
      return 0;
    }
  }

  this.blocks.push(blk);
  return 1;

}
Mempool.prototype.importBlock = function importBlock(blkjson) {
  var blk = new saito.block(this.app, blkjson);
  this.addBlock(blk);
}
Mempool.prototype.removeTransaction = function removeTransaction(tx) {
  for (t = 0; t < this.transactions.length; t++) {
    if (this.transactions[t].transaction.sig == tx.transaction.sig) {
      pos_to_remove = t+1;
      this.transactions = this.transactions.splice(0, pos_to_remove-1).concat(this.transactions.splice(1));
      // our array is one smaller
      t--;
    }
  }
}
Mempool.prototype.removeBlock = function removeBlock(blk) {
  for (b = 0; b < this.blocks.length; b++) {
    if (this.blocks[b].hash() == blk.hash()) {
      pos_to_remove = b+1;
      this.blocks = this.blocks.splice(0, pos_to_remove-1).concat(this.blocks.splice(1));
      // our array is one smaller
      b--;
    }
  }
}
Mempool.prototype.removeGoldenTicket = function removeGoldenTicket() {

  // add mempool transactions
  for (i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].transaction.gt != null) {
      this.removeTransaction(this.transactions[i]);
      return;
    }
  }

}















/////////////////////
// Bundling Blocks //
/////////////////////
//
// Bundling is the process of looking into our transaction pool
// and creating a block if we have enough transactions to justify
// it given the difficulty curve.
//
Mempool.prototype.startBundling = function startBundling() {

  if (this.bundling_blocks == 1) { return; }

  mempool_self = this;

  this.bundling_timer = setInterval(function() {

    // only run this timer if we are processing a bundle
    if (this.processing_bundle == 1) {} else {

      var fees_needed = 0;

      // fetch latest block to determine if fees are needed
      latestBlk = mempool_self.app.blockchain.returnLatestBlock();
      if (latestBlk != null) {

        // we need to improve the organization of where this happens
        // this is code copied from the block class, where we expect
        // to have a block object to run it, but here we don't have
        // a block object.
        //
        // refactor at some point
        //
        //
        var unixtime_original        = mempool_self.app.blockchain.returnUnixtime(latestBlk.hash());
        var unixtime_current         = new Date().getTime();
        var milliseconds_since_block = unixtime_current - unixtime_original;
        var feesneeded = ( latestBlk.returnBurnFee() - (latestBlk.returnFeeStep() * milliseconds_since_block) );
        if (feesneeded < 0) { feesneeded = 0; }

        fees_needed = feesneeded.toFixed(8);
      }


      var fees_available = mempool_self.returnTransactionFees();
      if (fees_available < 0) { fees_available = 0; }

      console.log(fees_available + " ------> "+ fees_needed);

      if (fees_available >= fees_needed) {
        mempool_self.processing_bundle = 1;
        mempool_self.createBlock(latestBlk);
        mempool_self.processing_bundle = 0;
      }
    }

  }, this.bundling_speed);

}
Mempool.prototype.stopBundling = function stopBundling() {
  clearInterval(this.bundling_timer);
  this.bundling_blocks = 0;
  this.processing_bundle = 0;
}








//////////////////////
// Block Management //
//////////////////////
Mempool.prototype.createBlock = function createBlock(prevblk) {

  // create block
  var nb = new saito.block(this.app);

  // add mempool transactions
  for (i = 0; i < this.transactions.length; i++) {
    nb.addTransaction(this.transactions[i]);
  }

  // let the block finish itself
  nb.createBlock(prevblk);

  return nb;

}
Mempool.prototype.processBlocks = function processBlocks() {

  if (this.processing_blocks == 1) { return; }
  if (this.blocks.length == 0) {
    this.processing_blocks = 0;
    return;
  }

  this.processing_blocks = 1;

  mempoolself = this;

  this.processing_timer = setInterval(function() {

    // FIFO adding from our queue
    blk = mempoolself.returnBlock();
    mempoolself.app.blockchain.indexAndStore(blk);
    mempoolself.cleanup(blk);


    // if we have emptied our queue
    if (mempoolself.blocks.length == 0) {
      clearInterval(mempoolself.processing_timer);
      mempoolself.processing_blocks = 0;
    }

  }, this.processing_speed);

}

// remove processed transactions from our mempool
// so that we don't inadvertantly add them into
// our own blocks
Mempool.prototype.cleanup = function cleanup(blk) {
  for (bt = 0; bt < blk.transactions.length; bt++) {
    this.removeTransaction(blk.transactions[bt]);
  }
  this.removeBlock(blk);
}















Mempool.prototype.returnBlock = function returnBlock() {
  return this.blocks.shift();
}
Mempool.prototype.returnTransactionFees = function returnTransactionFees() {
  var v = 0;
  for (i = 0; i < this.transactions.length; i++) {
    v += this.transactions[i].returnFee();
  }
  return v.toFixed(8);
}




