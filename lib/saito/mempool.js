var saito = require('../saito');
const request = require('request');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');


function Mempool(app) {

  if (!(this instanceof Mempool)) {
    return new Mempool(app);
  }

  this.app                        = app || {};

  this.data_directory             = path.join(__dirname, '../data/');
  this.downloads                  = []; // array
  this.transactions               = []; // array
  this.blocks                     = []; // queue
  this.clearing_mempool           = 0;
  this.processing_blocks          = 0;
  this.processing_timer           = null;
  this.processing_speed           = 300; // 0.3 seconds (add blocks)
  this.bundling_speed             = 400; // 0.4 seconds
  this.bundling_blocks            = 0;
  this.creating_block             = 0;  // 1 if is currently calculating expired fees, etc.         
  this.bundling_fees_needed       = -1;
  this.bundling_timer             = null;
  this.load_time                  = new Date().getTime();
  this.load_delay                 = 4000; // delay on startup

  this.downloading_blocks          = 0;
  this.downloading_timer           = null;
  this.downloading_speed           = 30000; // 30 seconds


  // bundling must be slower than processing
  if (this.bundling_speed < this.processing_speed) {
    this.bundling_speed = this.processing_speed+100;
  }

  return this;

}
module.exports = Mempool;







// get block from other host after notification
Mempool.prototype.fetchBlock = function fetchBlock(peer, block_filename, block_hash) {

  var mempool_self = this;

  // start our loop to clear block download queue
  if (mempool_self.downloading_timer == null) {
    mempool_self.downloading_timer = setInterval(function() {
      var current_time = new Date().getTime();
      for (var i = 0; i < mempool_self.downloads.length; i++) {
        if (mempool_self.downloads[i].finished != 0) {
	  // if we finished downloading this 30 seconds ago, remove it
          if ((current_time - mempool_self.downloads[i].finished) > 30000) {
	    // delete from disk if not moved too
	    if (mempool_self.downloads[i].moved == 0) {
              fs.unlink(mempool_self.downloads[i].save_file, function(error) {});
	    }
	    // delete from array
	    mempool_self.downloads.splice(i, 1);
	  }
        }
      }
    }, mempool_self.downloading_speed);
  }


  // check download NOT in progress
  for (var i = 0; i < mempool_self.downloads.length; i++) {
    if (mempool_self.downloads[i].bhash == block_hash) { return; }
  }


  var peer_url  = "http://" + peer.peer.host + ":" + peer.peer.port + "/blocks/" + block_filename;
  var save_dir  = mempool_self.data_directory + "/tmp/";
  var filename  = 'tmp_' + crypto.randomBytes(4).readUInt32LE(0) + '.blk.zip';
  var save_file = save_dir + filename;

  var mdl       = mempool_self.downloads.length;
                  mempool_self.downloads[mdl] = {}
                  mempool_self.downloads[mdl].peer = peer;
                  mempool_self.downloads[mdl].save_file = filename;
                  mempool_self.downloads[mdl].orig_file = block_filename;
                  mempool_self.downloads[mdl].bhash = block_hash;
                  mempool_self.downloads[mdl].finished = 0;
                  mempool_self.downloads[mdl].moved = 0;

  var requestSettings = {
    url: peer_url,
    method: 'GET',
    encoding: null
  }

if (this.app.BROWSER == 0) {
  request(requestSettings, function(err, res, body) {
    fs.writeFile(save_file, body, function(err) {
      if (err) { return console.log(err); }
	mempool_self.app.storage.openBlockByTmpZipFilename(filename, block_filename, function(storage_self, blk) {

          for (var b = 0; b < mempool_self.downloads.length; b++) {

	  if (mempool_self.downloads[b].bhash = blk.returnHash()) {
            mempool_self.downloads[b].finished = new Date().getTime();
	    blk.tmp_filename = filename;
            // add to blockchain, which lite-validates and adds to mempool
	    mempool_self.app.blockchain.addBlock(blk);
	    return;
	  }

	  }
        });
    });
  });
}


}





// do not add here directly, this is called by the 
// blockchain.js addBlock which also does initial
// validation and relays blocks
Mempool.prototype.addBlock = function addBlock(blk) {
  for (var i = 0; i < this.blocks.length; i++) {
    if (this.blocks[i].returnHash() == blk.returnHash()) { return 0; }
  }
  this.blocks.push(blk);
  return 1;
}
Mempool.prototype.addTransaction = function addTransaction(tx, relay_on_validate=1) {

  var transaction_imported = 0;  

  // avoid adding twice
  if (this.containsTransaction(tx) == 1) { return; }
  if (tx == null) 			 { return; }
  if (tx.transaction == null) 		 { return; }

  // only accept one golden ticket
  if (tx.transaction.gt != null) {
    for (var z = 0; z < this.transactions.length; z++) {
      if (this.transactions[z].transaction.gt != null) {
	if (this.transactions[z].transaction.gt.target == this.app.blockchain.returnLatestBlockHash()) {
          if (tx.returnFeeUsable() > this.transactions[z].returnFeeUsable() || (this.transactions[z].transaction.from[0].add != this.app.wallet.returnPublicKey() && tx.transaction.from[0].add == this.app.wallet.returnPublicKey())) {
            this.transactions[z] = tx;
	    transaction_imported = 1;
            z = this.transactions.length+1;
          } else {
	    transaction_imported = 1;
	  }
        } else {
	  transaction_imported = 1;
	}
      }
    }
  }

  if (transaction_imported == 0) {
    var mempool_self = this;
    this.app.storage.validateTransactionInputs(tx, function(app, tx) {
      if (relay_on_validate == 1) {
	// propagate if we can't use tx to create a block
	if ( this.bundling_fees_needed > tx.returnFeeUsable() ) {
          mempool_self.app.network.propagateTransaction(tx);
	}
      }
      mempool_self.transactions.push(tx);
    });
  }

}
Mempool.prototype.importTransaction = function importTransaction(txjson) {
  var tx = new saito.transaction(txjson);
  this.addTransaction(tx);
}
Mempool.prototype.containsTransaction = function containsTransaction(tx) {

  if (tx == null)             { return 0; }
  if (tx.transaction == null) { return 0; }

  for (var mtp = 0; mtp < this.transactions.length; mtp++) {
    if (this.transactions[mtp].transaction.sig == tx.transaction.sig) { 
      return 1; 
    }
  }
  return 0;
}
// perhaps we can sort the mempool list of transactions by sig on insert?
Mempool.prototype.containsTransactionWithSig = function containsTransactionWithSig(sig) {
  if (sig == null)             { return 0; }
  for (var mtp = 0; mtp < this.transactions.length; mtp++) {
    if (this.transactions[mtp].transaction.sig == sig) { 
      return 1; 
    }
  }
  return 0;
}
Mempool.prototype.importBlock = function importBlock(blkjson) {
  this.last_block_import          = new Date().getTime();
  var blk = new saito.block(this.app, blkjson);
  this.addBlock(blk);
}
Mempool.prototype.removeTransaction = function removeTransaction(tx) {
  if (tx == null) { return; }
  for (var t = this.transactions.length-1; t >= 0; t--) {
    if (this.transactions[t].transaction.sig == tx.transaction.sig) {
      this.transactions.splice(t, 1);
    }
  }
}
Mempool.prototype.removeBlock = function removeBlock(blk) {
  for (var b = this.blocks.length-1; b >= 0; b--) {
    if (this.blocks[b].returnHash() == blk.returnHash()) {
      this.blocks.splice(b, 1);
    }
  }
}
Mempool.prototype.removeGoldenTicket = function removeGoldenTicket() {
  for (var i = this.transactions.length-1; i >= 0; i--) {
    if (this.transactions[i].transaction.gt != null) {
      this.transactions.splice(i, 1);
    }
  }
}





/////////////////////
// Bundling Blocks //
/////////////////////
Mempool.prototype.startBundling = function startBundling() {

  if (this.bundling_blocks == 1) { return; }

  var mempool_self = this;

  this.bundling_timer = setInterval(function() {

    if (mempool_self.processing_blocks == 0 && mempool_self.creating_block == 0 && mempool_self.app.blockchain.currently_indexing == 0 && mempool_self.app.blockchain.reclaiming_funds == 0 && mempool_self.clearing_mempool == 0 && mempool_self.app.storage.reindexing_blocks == 0) {

      // if our storage class is re-indexing blocks, we don't want
      // to start creating stuff. wait until we have finished before
      // we start generating new blocks
      if (mempool_self.app.storage.reindexing_blocks == 1) { return; }

      var fees_needed = 0;

      var latestBlk = mempool_self.app.blockchain.returnLatestBlock();

      if (latestBlk == null) { 
        latestBlk = new saito.block(mempool_self.app); 
	latestBlk.block.id = 0; 
      }

      if (latestBlk != null) {
        // from block class -- refactor at some point
        var unixtime_original        = mempool_self.app.blockchain.returnUnixtime(latestBlk.returnHash());
        var unixtime_current         = new Date().getTime();
        var milliseconds_since_block = unixtime_current - unixtime_original;
        var feesneeded = ( latestBlk.returnBurnFee() - (latestBlk.returnFeeStep() * milliseconds_since_block) );
        if (feesneeded < 0) { feesneeded = 0; }
        fees_needed = feesneeded.toFixed(8);
      }

      var fees_available = mempool_self.returnUsableTransactionFees();

      if (fees_available < 0) { fees_available = 0; }

      mempool_self.bundling_fees_needed = feesneeded - fees_available;

console.log((new Date()) + ": " + fees_needed + " ---- " + fees_available + " (" + mempool_self.transactions.length + "/"+mempool_self.returnNormalTransactionsInMempool()+" -- "+mempool_self.app.wallet.returnBalance()+")");

	
      // we only produce a block if we have at least one transaction in the mempool
      if (parseFloat(fees_available) >= parseFloat(fees_needed) && ( (mempool_self.returnNormalTransactionsInMempool() > 0 || mempool_self.app.wallet.returnBalance() < 10000) || mempool_self.app.blockchain.index.hash.length == 0)) {

	// we do create free-token blocks unless on private network
        if (mempool_self.app.wallet.returnBalance() < 100 && mempool_self.returnNormalTransactionsInMempool() == 0) {
          var tmptime = new Date().getTime();
          if (mempool_self.app.network.returnFullNodePeersTotal() > 0) {
            return;
          } else {
            if (mempool_self.app.options.peers != null) {
              if (mempool_self.app.options.peers.length > 0) {
                // ensure the peer is not myself
                if (mempool_self.app.options.server != null) {
                  if (mempool_self.app.options.peers.length == 1 && mempool_self.app.options.peers[0].host == mempool_self.app.options.server.host) {} else { 
	            return;
	          }
                } else {
                  return;
                }
              }
            }
          }
        }

	// do not create unless we have 1 transaction
        if (mempool_self.containsGoldenTicket() == 0 && latestBlk.block.id != 0 && mempool_self.returnNormalTransactionsInMempool() == 0) { return; }

        // do not create first block as SPV client
        if ( (mempool_self.app.BROWSER == 0 && mempool_self.app.SPVMODE == 0) || mempool_self.app.blockchain.index.length > 0) {

	  // only create a new block if block pool is empty
	  if (mempool_self.blocks.length == 0) {

	    // FOR SPAMMER MODULE TESTING
	    // do not create unless one golden ticket
	    if (mempool_self.containsGoldenTicket() == 1 || latestBlk.block.id < 3) {
              mempool_self.createBlock(latestBlk);
	    }

	  }
        }
      }
    } else {
      console.log("... mempool loop: " + mempool_self.processing_blocks + " - " + mempool_self.creating_block + " - " + mempool_self.app.blockchain.currently_indexing + " -- " + mempool_self.app.blockchain.reclaiming_funds + " -- " + mempool_self.clearing_mempool);
    }
  }, this.bundling_speed);

}
Mempool.prototype.stopBundling = function stopBundling() {
  clearInterval(this.bundling_timer);
  this.bundling_blocks = 0;
}
Mempool.prototype.createBlock = function createBlock(prevblk) {

  // creating a block requires DB access for things
  // like figuring out the reclaimed fees. this can
  // cause bad blocks to pile up in the creation process
  // at large data blocks, so we check to make sure
  // we are not already in the process of bundling
  // one before we try again....
  //
  // this variable is unset when we pass the 
  // block to addBlockToBlockchain or when it fails 
  // in the validation stage.
  if (this.creating_block == 1) { return; }
  this.creating_block = 1;

  var nb = new saito.block(this.app);

  // add mempool transactions
  for (var i = 0; i < this.transactions.length; i++) {
    var addtx = 1;
    if (this.transactions[i].transaction.gt != null) { 
      if (this.transactions[i].transaction.gt.target != prevblk.returnHash()) { 
        addtx = 0; 
      } 
    }
    if (addtx == 1) { nb.addTransaction(this.transactions[i]); }
  }

  // add transaction to capture fees
  var my_fees    = nb.returnSurplusFees();
  if (my_fees == null) { my_fees = 0.0; }
  if (my_fees > 0) {
    tx2 = this.app.wallet.createFeeTransaction(my_fees);
    nb.addTransaction(tx2);
  }

  nb.bundleBlock(prevblk);

  return;

}
Mempool.prototype.processBlocks = function processBlocks() {

  if (this.processing_blocks == 1) { 
    console.log("Mempool processing.... no adding new block to blockchain");
    return; 
  }

  if (this.blocks.length == 0) {
    console.log("Mempool processing.... no blocks to add to blockchain");
    this.processing_blocks = 0;
    return;
  }

  var mempool_self = this;

  if (this.processing_timer == null) {
    this.processing_timer = setInterval(function() {

      if (mempool_self.clearing_mempool == 1) { return; }

      if (mempool_self.processing_blocks == 1) { return; }
      mempool_self.processing_blocks = 1;

      if (mempool_self.blocks.length == 0) {
        mempool_self.processing_blocks = 0;
        return;
      }

      // FIFO adding from our queue
      var blk = mempool_self.returnBlock();

      // add and delete block unless we get kickback
      if (blk != null) {
        var delete_blk_from_mempool = 0;
        if (blk.prevalidated == 0) {
          delete_blk_from_mempool = mempool_self.app.blockchain.addBlockToBlockchain(blk);
	} else {
          delete_blk_from_mempool = mempool_self.app.blockchain.addBlockToBlockchain(blk, "force");
	}
        if (delete_blk_from_mempool == 1) {
          mempool_self.clear_mempool(blk);
        }
      }

      // if we have emptied our queue
      if (mempool_self.blocks.length == 0) {
        clearInterval(mempool_self.processing_timer);
        mempool_self.processing_timer = null;
      }

      mempool_self.processing_blocks = 0;

    }, mempool_self.processing_speed);
  }

}
Mempool.prototype.clear_mempool = function clear_mempool(blk) {
  this.clearing_mempool = 1;
  for (var bt = blk.transactions.length-1; bt >= 0; bt--) {
    this.removeTransaction(blk.transactions[bt]);
  }
  this.removeBlock(blk);
  this.clearing_mempool = 0;
}
Mempool.prototype.removeGoldenTicket = function removeGoldenTicket() {
  for (var i = this.transactions.length-1; i >= 0; i--) {
    if (this.transactions[i].transaction.gt != null) {
      this.removeTransaction(this.transactions[i]);
      return;
    }
  }
}




Mempool.prototype.containsGoldenTicket = function containsGoldenTicket() {
  for (var m = 0; m < this.transactions.length; m++) {
    if (this.transactions[m].isGoldenTicket() == 1) { return 1; }
  }
  return 0;
}
Mempool.prototype.returnBlock = function returnBlock() {
  var tmpblk = this.blocks[0];
  return tmpblk;
}
Mempool.prototype.returnUsableTransactionFees = function returnUsableTransactionFees() {
  var v = 0;
  for (var i = 0; i < this.transactions.length; i++) {
    v += this.transactions[i].returnFeeUsable();
  }
  return v.toFixed(8);
}
Mempool.prototype.returnNormalTransactionsInMempool = function returnNormalTransactionsInMempool() {
  var v = 0;
  for (var i = 0; i < this.transactions.length; i++) {
    if (this.transactions[i].transaction.gt == null) { v++; }
  }
  return v;
}

