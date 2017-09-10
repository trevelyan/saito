var saito = require('../saito');


function Mempool(app) {

  if (!(this instanceof Mempool)) {
    return new Mempool(app);
  }

  this.app                        = app || {};

  /////////////
  // mempool //
  /////////////
  this.transactions               = []; // array
  this.blocks                     = []; // queue


  ///////////////////////
  // processing blocks //
  ///////////////////////
  this.processing_blocks          = 0;
  this.processing_timer           = null;
  this.processing_speed           = 200; // 0.5 seconds
					 // processing speed must be 
					 // faster than bundling speed
					 // to avoid bugs
					 //
					 // is speed of adding blocks
  ///////////////////////////
  // bundling transactions //
  ///////////////////////////
  this.bundling_blocks            = 0;
  this.bundling_timer             = null;
  this.bundling_speed             = 340; // 0.7 seconds
					 // is speed of creating blocks
					 // 
					 // must be slower than processing speed
					 // to avoid bugs

  this.processing_bundle          = 0;
  this.processing_bundle_tmpts    = -1;

  // ensure that our bundling speed is slower than
  // our processing speed to avoid problems with 
  // multiple blocks being created during the 
  // brief windows when fee levels permit them
  if (this.bundling_speed < this.processing_speed) {
    this.bundling_speed = this.processing_speed+100;
  }

  return this;

}
module.exports = Mempool;





/////////////////////////////////////////////////
// Adding and Removing Blocka and Transactions //
/////////////////////////////////////////////////
Mempool.prototype.addTransaction = function addTransaction(tx) {

  transaction_imported = 0;  

  // check to see if this transaction has already 
  // been included in a block or is already in our 
  // mempool, so as not to add twice

  if (this.containsTransaction(tx) == 1) { 
console.log("NOT ADDING TX -- already in mempool");
    return; 
  }



  // we only accept one golden ticket, so check here
  // and if we already have a golden ticket, compare 
  // the fees and take the higher-paying ticket
  if (tx.transaction.gt != null) {
    for (z = 0; z < this.transactions.length; z++) {
      if (this.transactions[z].transaction.gt != null) {
        new_tx_fee = tx.returnUsableFee();
        old_tx_fee = this.transactions[z].returnUsableFee();
        if (new_tx_fee > old_tx_fee) {
          this.transactions[z] = tx;
	  transaction_imported = 1;
          z = this.transactions.length+1;
        } else {
	  transaction_imported = 1;
	}
      }
    }
  }
  if (transaction_imported == 0) {
  
    mempool_self = this;

    // validate and add
    tx.validateInputsWithCallbackOnSuccess(mempool_self.app, function(app, tx) {
      mempool_self.transactions.push(tx);
    });

  }

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
Mempool.prototype.containsTransaction = function containsTransaction(tx) {

  // return 1 if our mempool contains this transaction, avoiding duplicates
  for (mtp = 0; mtp < this.transactions.length; mtp++) {
    // safe to assume identical sigs are identical transactions
    if (this.transactions[mtp].transaction.sig == tx.transaction.sig) { return 1; }
  }
  return 0;
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
      this.blocks.splice(b, 1);
      return;
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
    if (mempool_self.processing_bundle == 1) {} else {

      var fees_needed = 0;

      // fetch latest block to determine if fees are needed
      latestBlk = mempool_self.app.blockchain.returnLatestBlock();

      // if this is our first block ever
      if (latestBlk == null) { 
        latestBlk = new saito.block(mempool_self.app); 
	latestBlk.block.id = 0; 
      }

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

      var fees_available = mempool_self.returnUsableTransactionFees();
      if (fees_available < 0) { fees_available = 0; }
console.log(fees_needed + " ---- " + fees_available + " (" + mempool_self.transactions.length + "/"+mempool_self.returnNormalTransactionsInMempool()+" -- "+mempool_self.app.wallet.returnBalance()+")");

	
      // we only produce a block if we have at least one transaction in the mempool
      // this avoids block congestion at an early stage of development while allowing
      // us to keep a fast blocktime when people are using the network
      if (parseFloat(fees_available) >= parseFloat(fees_needed) 
	  // > 1 means we have a golden ticket AND a regular transaction
	  && (    
		(mempool_self.returnNormalTransactionsInMempool() > 0 || mempool_self.app.wallet.returnBalance() < 100)
	      || mempool_self.app.blockchain.index.hash.length == 0)
      ) {



          // we do not create a block if it is the FIRST block
          // and we are a browser or SPV client. This avoids clients
          // creating a block immediately upon startup and clogging
          // the network. This way we can create blocks, but at least
          // wait for ourselves to receive a block first
          if ( (mempool_self.app.BROWSER == 0 && mempool_self.app.SPVMODE == 0) || mempool_self.app.blockchain.index.length > 0) {
            mempool_self.createBlock(latestBlk);
          }
      }

      mempool_self.processing_bundle = 0;
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


  mempoolself = this;

  this.processing_timer = setInterval(function() {

      if (this.processing_blocks == 1) { return; }
      this.processing_blocks = 1;


      // FIFO adding from our queue
      blk = mempoolself.returnBlock();


      // add and delete block unless we get kickback
      if (blk != null) {
        mempoolself.app.blockchain.indexAndStore(blk);
        mempoolself.cleanup(blk);
      }

      // if we have emptied our queue
      if (mempoolself.blocks.length == 0) {
        clearInterval(mempoolself.processing_timer);
        mempoolself.processing_blocks = 0;
      }



      this.processing_blocks = 0;

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

Mempool.prototype.removeGoldenTicket = function removeGoldenTicket() {
  for (i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].transaction.gt != null) {
      this.removeTransaction(this.transactions[i]);
      return;
    }
  }
}













Mempool.prototype.returnBlock = function returnBlock() {
  return this.blocks.shift();
}
Mempool.prototype.returnUsableTransactionFees = function returnUsableTransactionFees() {
  var v = 0;
  for (i = 0; i < this.transactions.length; i++) {
    v += this.transactions[i].returnUsableFee();
  }
  return v.toFixed(8);
}
Mempool.prototype.returnNormalTransactionsInMempool = function returnNormalTransactionsInMempool() {
  var v = 0;
  for (i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].transaction.gt == null) { v++; }
  }
  return v;
}




