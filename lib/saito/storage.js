var saito    = require('../saito');
var fs       = require('fs');
var shashmap = require('shashmap');
var os       = require('os');
var unzip    = require('unzip');
var mv       = require('node-mv');
var path     = require('path');




/////////////////
// Constructor //
/////////////////
function Storage(app) {

  if (!(this instanceof Storage)) {
    return new Storage(app);
  }

  this.app  = app || {};

  this.db = null;

  this.data_directory             = path.join(__dirname, '../data/');
  this.delete_old_data            = 1; // delete old data from database?
  this.defragment_db              = 1;
  this.defragment_count           = 0;
  this.defragment_limit           = 100; // every 100 blocks, defragment the DB

  this.reindexing_blocks          = 0;
  this.reindexing_chunk           = 0;
  this.reindexing_timer           = null;
  this.reindexing_speed           = 2000; // 0.5 seconds (add blocks)

  this.send_blocks_queue_limit    = 5;

  this.saving_blocks              = 0;
  this.saving_slips               = 0;
  this.spending_slips             = 0;


  ///////////////////////
  // scaling variables //
  ///////////////////////
  this.memory_only_db             = 0;  // 0 for disk-written database



  /////////////////////////////
  // scaling data structures //
  /////////////////////////////
  this.spent_hashmap               = [];
  this.dbname               	   = "./data/database.sq3";

  return this;  
}
module.exports = Storage;







Storage.prototype.createDatabaseTables = function createDatabaseTables() {

  if (this.app.BROWSER == 1) { return; }

  var storage_self = this;

  this.execDatabase("\
        CREATE TABLE IF NOT EXISTS blocks (\
                id INTEGER, \
                reindexed INTEGER, \
                block_id INTEGER, \
                min_tx_id INTEGER, \
                max_tx_id INTEGER, \
                block_json_id INTEGER, \
                hash TEXT, \
                conf INTEGER, \
                longest_chain INTEGER, \
                UNIQUE (block_id, hash), \
                PRIMARY KEY(id ASC) \
        )", 
	{}, 
	function() {
 	   	//storage_self.app.storage.execDatabase("CREATE INDEX blocks_idx ON blocks (block_id, longest_chain)", {}, function() {});
 	   	//storage_self.app.storage.execDatabase("CREATE INDEX blocks_idx2 ON blocks (reindexed)", {}, function() {});
 	   	//storage_self.app.storage.execDatabase("CREATE INDEX blocks_idx3 ON blocks (hash)", {}, function() {});
 	}
  );
}
Storage.prototype.deleteBlocks = function deleteBlocks(block_id) {

  // browser apps dump old data
  if (this.app.BROWSER == 1) { return; }

  var storage_self = this;


  var sql = "SELECT * FROM blocks WHERE block_id < $block_id";
  var params = {
    $block_id: block_id
  }

  storage_self.queryBlockchainArray(sql, params, function (err, rows) {
    var sql7 = "DELETE FROM blocks WHERE block_id < $block_id";
    storage_self.db.run(sql7, {
      $block_id: block_id
    });
  });


  // defragment database every so often
  if (this.defragment_db == 1) {
    this.defragment_count++;
    if (this.defragment_count >= this.defragment_limit) {
      var sql7 = "VACUUM";
      console.log(" ... defragmenting block database ... ");
      this.db.run(sql7, {}, function(err) {});
    }
  }
}
Storage.prototype.initialize = function initialize() {

  if (this.app.BROWSER == 0) {

    //////////////
    // database //
    //////////////
    var sqlite3 = require('sqlite3').verbose();
    if (this.memory_only_db == 0) {
      this.db = new sqlite3.Database(this.dbname);
    } else {
      this.db = new sqlite3.Database(':memory:');
    }
    this.createDatabaseTables();


    // pragma temp store -- temp objects in memory (2) (default = 0)
    this.execDatabase("PRAGMA temp_store = 2", {}, function (){});

    // controls pagesize. default is 4096
    this.execDatabase("PRAGMA page_size = 32768", {}, function (){});

    // increase cache size (default is 1024) 
    this.execDatabase("PRAGMA cache_size = 512000", {}, function (){});

    // radically faster db writes at cost of corruption on power failure
    this.execDatabase("PRAGMA synchronous = OFF", {}, function (){});

    // locking mode means only one connection (nodsjs) but increases speed (default: NORMAL)
    this.execDatabase("PRAGMA locking_mode = EXCLUSIVE", {}, function (){});

    // depreciated by small tweak
    this.execDatabase("PRAGMA count_changes = false", {}, function (){});
  
    // no rollbacks and db corruption on power failure
    this.execDatabase("PRAGMA journal_mode = OFF", {}, function (){});

  }

  this.loadOptions();
}
Storage.prototype.loadOptions = function loadOptions() {

  var storage_self = this;

  if (this.app.BROWSER == 0) {

    try {
      this.app.options = JSON.parse(
        fs.readFileSync(__dirname + '/../options', 'utf8', (err, data) => {
          if (err) {
            console.log("Error Reading Options File");
            throw err;
          }
        })
      );
    } catch (err) {
      this.saveOptions();
    }

  } else {

    var data = null;

    if (typeof(Storage) !== "undefined") {
      data = localStorage.getItem("options");
      this.app.options = JSON.parse(data);
    }

    if (data == null) {
      $.ajax({
        url: '/client.options',
        dataType: 'json',
        async: false,
        success: function(data) {
          storage_self.app.options = data;
        }
      });
    }
  }
}
Storage.prototype.saveBlock = function saveBlock(blk, lc = 0) {

  if (this.app.BROWSER == 1) { return; }

  var storage_self = this;
  this.saving_blocks     = 1;

  ///////////
  // slips //
  ///////////
  //
  // we insert the slips so we can manipulate them, but we do not include
  // the transaction slip validation at this point, because we only want
  // to validate the slips themselves when we switch over to the longest
  // chain.
  //
  for (var b = 0; b < blk.transactions.length; b++) {
    for (var bb = 0; bb < blk.transactions[b].transaction.to.length; bb++) {
      if (blk.transactions[b].transaction.to[bb].amt > 0) {
        var slip_map_index = storage_self.returnHashmapIndex(blk.block.id, blk.transactions[b].transaction.id, blk.transactions[b].transaction.to[bb].sid, blk.transactions[b].transaction.to[bb].add, blk.transactions[b].transaction.to[bb].amt, blk.returnHash());
        shashmap.insert_slip(slip_map_index, -1);
      }
    }
  }


  /////////////
  // hashmap //
  /////////////
  //
  // admittedly messy / hacky
  // 
  // adjusts variable in blockchain class
  //
  storage_self.app.blockchain.lc_hashmap[blk.returnHash()] = lc;


  ///////////////////////////////
  // figure our min/max tx_ids //
  ///////////////////////////////
  var mintxid = 0;
  var maxtxid = 0;

  if (blk.transactions.length > 0) {
    mintx = JSON.parse(blk.block.transactions[0]);
    maxtx = JSON.parse(blk.block.transactions[blk.block.transactions.length-1]);
    maxtxid = maxtx.id;
    mintxid = mintx.id;
  }



  //////////////////
  // SAVE TO DISK //
  //////////////////
  var sql2 = "INSERT INTO blocks (block_id, reindexed, block_json_id, hash, conf, longest_chain, min_tx_id, max_tx_id) VALUES ($block_id, 1, $block_json_id, $hash, 0, $lc, $mintxid, $maxtxid)";
  var params2 = {
    $block_id: blk.block.id,
    $block_json_id : 0,
    $hash: blk.returnHash(),
    $lc: lc,
    $mintxid: mintxid,
    $maxtxid: maxtxid
  };

  if (blk.saveDatabaseId > -1) {
    sql2 = "INSERT INTO blocks (id, block_id, reindexed, block_json_id, hash, conf, longest_chain, min_tx_id, max_tx_id) VALUES ($dbid, $block_id, 1, $block_json_id, $hash, 0, $lc, $mintxid, $maxtxid)";
    params2 =  {
      $dbid: blk.saveDatabaseId,
      $block_id: blk.block.id,
      $block_json_id : 0,
      $hash: blk.returnHash(),
      $lc: lc,
      $mintxid: mintxid,
      $maxtxid: maxtxid
    }
  }

  storage_self.db.run(sql2, params2, function(err) {

    if (this.lastID != undefined) {

      //////////////////
      // SAVE TO DISK //
      //////////////////
      var tmp_filename = blk.block.id + "-" + this.lastID + ".blk";
      var tmp_filepath = storage_self.data_directory + "blocks/" + tmp_filename; 

      // write file if it does not exist
      if ( ! fs.existsSync(tmp_filepath)) {
	//blk.compressSegAdd();
        fs.writeFileSync(tmp_filepath, JSON.stringify(blk.block), 'binary');
        this.saving_blocks     = 0;
      }

      blk.filename = tmp_filename;

    } else {

      ///////////////////
      // already saved //
      ///////////////////
      storage_self.saving_blocks = 0;
      return -1;	

    }
  });

  return 1;

}
// saves the client.options file that is fed out over the web to lite-nodes
// that connect to this node
Storage.prototype.saveClientOptions = function saveClientOptions() {

  if (this.app.BROWSER == 1) { return; }

  var t                  = {};
      t.archives             = [];
      if (this.app.options.archives != null) { t.archives = this.app.options.archives; }
      t.keys                 = [];
      t.peers                = [];
      t.dns                  = [];
      t.blockchain           = {};
      t.blockchain.lastblock = this.app.blockchain.returnLatestBlockId();
      t.peers.push(this.app.server.returnServer());

  if (this.app.options.dns != null) {
    var regmod = this.app.modules.returnModule("Registry");
    for (var x = 0; x < this.app.options.dns.length; x++) {
      if (regmod != null) {
        if (this.app.options.dns[x].domain = regmod.domain) {
          if (this.app.options.dns[x].publickey == "") { this.app.options.dns[x].publickey = this.app.wallet.returnPublicKey(); }
        }
      }
    }
    t.dns                = this.app.options.dns;
  }

  fs.writeFileSync("saito/web/client.options", JSON.stringify(t), function(err) {
    if (err) {
      console.log(err);
    }
  });
}


Storage.prototype.onChainReorganization = function onChainReorganization(block_id, block_hash, lc) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var storage_self = this;

  storage_self.app.blockchain.lc_hashmap[block_hash] = lc;

  ////////////
  // blocks //
  ////////////
  var sql = "UPDATE blocks SET longest_chain = $lc WHERE block_id = $block_id AND hash = $block_hash";
  this.db.run(sql, {
    $block_id: block_id,
    $block_hash: block_hash,
    $lc: lc
  }, function(err) {
  });

  // we do not change slip information. that is 
  // only updated when the longest chain is actually
  // validated / re-written, as any problems then
  // need to be tracked for immediate reversal if the
  // competing chain has a problem.

}
Storage.prototype.saveOptions = function saveOptions(reset = 0, saveBlockchain = 1) {

  var storage_self = this;

  if (storage_self.app.options == null) { storage_self.app.options = {}; }

  // update options
  if (this.app.options.wallet == null) {
    this.app.options.wallet     = this.app.wallet.returnWallet();
  }
  if (this.app.options.peers == null) {
    this.app.options.peers      = this.app.network.returnPeers();
  }
  if (this.app.options.blockchain == null) {
    this.app.options.blockchain = this.app.blockchain.returnBlockchain();
  } else {
    if (saveBlockchain == 1) {
      if (this.app.blockchain.returnLatestBlockId() > this.app.options.blockchain.latest_block_id) {
        this.app.options.blockchain.latest_block_ts = this.app.blockchain.returnLatestBlockUnixtime();
        this.app.options.blockchain.latest_block_id = this.app.blockchain.returnLatestBlockId();
        this.app.options.blockchain.latest_block_hash = this.app.blockchain.returnLatestBlockHash();
        this.app.options.blockchain.fork_id   = this.app.blockchain.returnForkId();
      }
    }
  }
  if (this.app.options.voter == null) {
    this.app.options.voter      = this.app.blockchain.voter.returnVoter();
  }
  if (this.app.options.server == null) {
    this.app.options.server     = this.app.server.returnServer();
  }
  if (this.app.options.keys == null) {
    this.app.options.keys       = this.app.keys.returnKeys();
  }
  if (this.app.options.archives == null) {
    this.app.options.archives   = this.app.archives.returnArchives();
  }
  if (this.app.options.dns == null) {
    this.app.options.dns        = this.app.dns.returnDNS();
  }

  if (reset == 1) {

    this.app.archives.resetArchives();
    this.app.wallet.resetWallet();

    var tmpdate = new Date().getTime();
    var loadurl = '/client.options?x='+tmpdate;

    $.ajax({
      url: loadurl,
      dataType: 'json',
      async: false,
      success: function(data) {
        storage_self.app.options = data;
	storage_self.saveOptions();
      }
    });

  } else {

    var storage_self = this;

    if (this.app.BROWSER == 0) {
      fs.writeFileSync("options", JSON.stringify(this.app.options), function(err) {
        if(err) {
          return console.log(err);
        }
      });
    } else {
      if (typeof(Storage) !== "undefined") {
        localStorage.setItem("options", JSON.stringify(this.app.options));
      }
    }
  }
}
Storage.prototype.validateSlip = function validateSlip() {
  storage_self.slips_validated++;
  if (storage_self.slips_validated == storage_self.slips_to_validate) { 
    console.log("ALL VALIDATED");
  }
}

Storage.prototype.saveConfirmation = function saveConfirmation(hash, conf) {

  if (this.app.BROWSER == 1) { return; }

  var sql = "UPDATE blocks SET conf = $conf WHERE hash = $hash";
  this.db.run(sql, {
    $conf: conf,
    $hash: hash
  });

}






//////////////////////////////////
// Read and Write from Database //
//////////////////////////////////
Storage.prototype.execBlockchain = function execBlockchain(sql, params, callback) {
  this.execDatabase(sql, params, callback);
}
Storage.prototype.execDatabase = function execDatabase(sql, params, callback) {
  if (this.app.BROWSER == 1) { return; }
  this.db.run(sql, params, function (err, row) { callback(err, row); });
}
Storage.prototype.queryDatabase   = function queryDatabase(sql, params, callback) { this.queryBlockchain(sql, params, callback); }
Storage.prototype.queryBlockchain = function queryBlockchain(sql, params, callback) {
  if (this.app.BROWSER == 1) { return; }
  this.db.get(sql, params, function (err, row) {
    callback(err, row);
  });
}
Storage.prototype.queryDatabaseArray   = function queryDatabaseArray(sql, params, callback) { this.queryBlockchainArray(sql, params, callback); }
Storage.prototype.queryBlockchainArray = function queryBlockchainArray(sql, params, callback) {
  if (this.app.BROWSER == 1) { return; }
  this.db.all(sql, params, function (err, rows) {
    callback(err, rows);
  });
}






/////////////////////////////////
// Transaction Validation Code //
/////////////////////////////////
//
// this is used by the miner and mempool when adding transactions to the mempool
//
Storage.prototype.validateTransactionInputs = function validateTransactionInputs(tx, mycallback) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { mycallback(this.app, tx); return; }

  var storage_self = this;
  var utxiarray = tx.transaction.from;
  var gtnum = 0;
  var map_found = 0;


  for (var via = 0; via < utxiarray.length; via++) {

    var utxi  = utxiarray[via];

     ////////////////////////
     // validate 0-payment //
     ////////////////////////
     if (utxi.amt == 0) {
        map_found++;
     } else {

       if (utxi.amt == 0 && utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && (utxi.gt == 1 || utxi.ft == 1)) { gtnum++; } else {

         //////////////////////
         // validate hashmap //
         //////////////////////
         var slip_map_index = this.returnHashmapIndex(utxi.bid, utxi.tid, utxi.sid, utxi.add, utxi.amt, utxi.bhash);
         if (shashmap.validate_slip(slip_map_index, storage_self.app.blockchain.returnLatestBlockId()) == 1) {
           map_found++;
         }
       }
     }
   }

  if (gtnum == utxiarray.length) { mycallback(this.app, tx); return; }
  if (gtnum+map_found >= utxiarray.length) { mycallback(this.app, tx); return; }

  return;

}
Storage.prototype.unspendTransactionInputs = function unspendTransactionInputs(blk, tx) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return 1; }

  var storage_self = this; 
  var utxiarray = tx.transaction.from;
  var gtnum = 0;
  var map_found = 0;

  for (var via = 0; via < utxiarray.length; via++) {

    var utxi  = utxiarray[via];

     ////////////////////////
     // validate 0-payment //
     ////////////////////////
     if (utxi.amt == 0) {
     } else {
       if (utxi.amt == 0 && utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && (utxi.gt == 1 || utxi.ft == 1)) {
       } else {
         var slip_map_index = this.returnHashmapIndex(utxi.bid, utxi.tid, utxi.sid, utxi.add, utxi.amt, utxi.bhash);
         shashmap.insert_slip(slip_map_index, -1);
       }
     }
   }

  return 1;

}




//
// unwindChain
//
// this rolls back the old Longest Chain and resets all of the slips
// that were SPENT to a fresh state so that our competing chain will
// have them available.
//
// it then calls the windChain function when it is ready to roll 
// forward and respend/validate those slips on the new longest chain
//
Storage.prototype.unwindChain = function unwindChain(newblock, pos, shared_ancestor_index_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, forceAdd, current_unwind_index, resetting_flag) {

  var storage_self = this;


  if (old_block_hashes.length > 0) {

    // unspend the slips in this block. We know that 
    // the block has been saved to disk so we just open
    // block by hash.
    storage_self.openBlockByHash(old_block_hashes[current_unwind_index], function(storage_self, blk) {

      storage_self.app.storage.onChainReorganization(blk.block.id, blk.returnHash(), 0);
      storage_self.app.wallet.onChainReorganization(blk.block.id, blk.returnHash(), 0);
      storage_self.app.modules.onChainReorganization(blk.block.id, blk.returnHash(), 0);

      storage_self.unspendBlockInputs(blk);
	
      // we either move on to our next block, or we hit
      // the end of the chain of blocks to validate and 
      // kick out to our next function
      //
      if (current_unwind_index == 0) {
        storage_self.windChain(newblock, pos, shared_ancestor_index_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, forceAdd, 0, resetting_flag);
      } else {
        storage_self.unwindChain(newblock, pos, shared_ancestor_index_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, forceAdd, current_unwind_index-1, resetting_flag);
      }

    });

  } else {
    storage_self.windChain(newblock, pos, shared_ancestor_index_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, forceAdd, 0, resetting_flag);
  }

}
Storage.prototype.unspendBlockInputs = function unspendBlockInputs(blk) {

  for (var x = 0; x < blk.transactions.length; x++) {
    for (var y = 0; y < blk.transactions[x].transaction.from.length; y++) {

      var utxi  = blk.transactions[x].transaction.from[y];
      var bhash = utxi.bhash;
      var bid   = utxi.bid;
      var tid   = utxi.tid;
      var sid   = utxi.sid;
      var amt   = utxi.amt;
      var add   = utxi.add;

      //////////////////////////
      // update spent hashmap //
      //////////////////////////
      if (amt > 0) {
        var slip_map_index = this.returnHashmapIndex(bid, tid, sid, add, amt, bhash);
        shashmap.insert_slip(slip_map_index, -1);
      }
    }
  }

  return 1;

}



//
// windChain
//
// this rolls our the new Longest Chain and validates all of the
// slips that in the new chain one-by-one. In the event of a problem
// we unwind our new chain and revert to the old chain, using 
// the resetting_flag == 1 to fork off to the addBlockToBlockchain
// failure function.
//

Storage.prototype.windChain = function windChain(newblock, pos, shared_ancestor_index_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, forceAdd, current_wind_index, resetting_flag) {

  var storage_self = this;

  var this_block_hash = new_block_hashes[current_wind_index];

  // we have not saved the latest block to disk yet, so
  // there's no need to go through the delay of opening
  // files from disk and needing a callback.
  //
  if (this_block_hash == newblock.returnHash()) {

    if (this.validateBlockInputs(newblock) == 1) {

      // we do not handle onChainReorganization for everything here, as we will run
      // it for the latest block immediately after saving the block.

      this.spendBlockInputs(newblock); 
      this.app.blockchain.addBlockToBlockchainPartTwo(newblock, pos, i_am_the_longest_chain, forceAdd);

    } else {

      if (current_wind_index == 0) {

	// this is the first block we have tried to add
	// and so we can just roll out the older chain
	// again as it is known good.
	//
	// note that old and new hashes are swapped 
	// and the old chain is set as null because
	// we won't move back to it. we also set the
	// resetting_flag to 1 so we know to fork
	// into addBlockToBlockchainFailure.
        //
	if (old_block_hashes.length > 0) {
	  storage_self.windChain(newblock, pos, shared_ancestor_index_pos, old_block_idxs, old_block_hashes, old_block_ids, null, null, null, i_am_the_longest_chain, forceAdd, 0, 1);
	} else {
	  // no need to rewrite, just trigger failure
          storage_self.app.blockchain.addBlockToBlockchainFailure(newblock, pos, i_am_the_longest_chain, forceAdd, -1);
// HACK
	}
      } else {

	// we need to unwind some of our previously 
	// added blocks from the new chain. so we 
	// swap our hashes to wind/unwind.

        var chain_to_unwind_hashes = new_block_hashes.splice(current_wind_index);
        var chain_to_unwind_idxs   = new_block_idxs.splice(current_wind_index);
        var chain_to_unwind_ids    = new_block_ids.splice(current_wind_index);

        // we need to unwind the stuff we've already WINDED and rewind the old chain.
	storage_self.unwindChain(newblock, pos, shared_ancestor_index_pos, old_block_idxs, old_block_hashes, old_block_ids, chain_to_unwind_idxs, chain_to_unwind_hashes, chain_to_unwind_ids, i_am_the_longest_chain, forceAdd, chain_to_unwind_hashes.length, 1);

      }
    }

  // this is not the latest block, so we need to 
  // fetch it from disk, and then do exactly the
  // same thing as above, essentially.
  } else {

    storage_self.openBlockByHash(new_block_hashes[current_wind_index], function(storage_self, blk) {

      if (storage_self.validateBlockInputs(blk) == 1) {

        storage_self.spendBlockInputs(blk);

	// if this is the last block, we push into either Part Two or Failed
        if (current_wind_index == new_block_idxs.length-1) {
	  if (resetting_flag == 0) {
            storage_self.app.blockchain.addBlockToBlockchainPartTwo(newblock, pos, i_am_the_longest_chain, forceAdd);
	  } else {
            storage_self.app.blockchain.addBlockToBlockchainFailure(newblock, pos, i_am_the_longest_chain, forceAdd, old_block_idxs[current_unwind_index]);
	  }
        } else {
          storage_self.windChain(newblock, pos, shared_ancestor_index_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, forceAdd, current_wind_index+1, resetting_flag);
	  return;
        }

// HACK

        storage_self.app.blockchain.addBlockToBlockchainPartTwo(newblock, pos, i_am_the_longest_chain, forceAdd);

      } else {

        if (current_wind_index == 0) {
	  storage_self.windChain(newblock, pos, shared_ancestor_index_pos, old_block_idxs, old_block_hashes, old_block_ids, null, null, null, i_am_the_longest_chain, forceAdd, 0, 1);
        } else {

          var chain_to_unwind_hashes = new_block_hashes.splice(current_wind_index);
          var chain_to_unwind_idxs   = new_block_idxs.splice(current_wind_index);
          var chain_to_unwind_ids    = new_block_ids.splice(current_wind_index);

	  storage_self.unwindChain(newblock, pos, shared_ancestor_index_pos, old_block_idxs, old_block_hashes, old_block_ids, chain_to_unwind_idxs, chain_to_unwind_hashes, chain_to_unwind_ids, i_am_the_longest_chain, forceAdd, chain_to_unwind_hashes.length, 1);
        }
      }
    });
  }
}




// this function takes the block as an input and decides if it is 
// valid or not depending on the slips that are included. It returns
// 1 for a valid block and 0 for an invalid block and does not worry
// about SPENDING any slips. Just validating the block first.
Storage.prototype.validateBlockInputs = function validateBlockInputs(newblock) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var storage_self = this;
  var spent_inputs = [];


  /////////////////////////////////////////
  // check against double-input spending //
  /////////////////////////////////////////
  var tmpgtfound = 0;
  var tmpftfound = 0;
  for (var ti = 0; ti < newblock.transactions.length; ti++) {
    var tx = newblock.transactions[ti];
    for (var ti2 = 0; ti2 < tx.transaction.from.length; ti2++) {
      var tmpbid = tx.transaction.from[ti2].bid;
      var tmptid = tx.transaction.from[ti2].tid;
      var tmpsid = tx.transaction.from[ti2].sid;

      // we may have multiple transactions claiming 0/0/0
      // these will be golden ticket and fee ticket tx
      var tmpgt  = tx.transaction.from[ti2].gt;
      var tmpft  = tx.transaction.from[ti2].ft;

      // only 1 ft-tagged slip in the FROM
      if (tmpft == 1) {
        if (tmpftfound == 1) { 
	  console.log("Block invalid: multiple fee capture transactions in block");
	  return 0;
	} else {
	  tmpftfound = 1;
	}
      }

      // we can have multiple golden ticket-tagged sources in the block, but the BID/SID/TID will differ
      var as_indexer = "a"+tmpbid+"-"+tmptid+"-"+tmpsid+"-"+tmpgt;
      if (spent_inputs[as_indexer] == 1) {
        console.log("Block invalid: multiple transactions spend same input: "+tmpbid+"/"+tmptid+"/"+tmpsid+"/"+tmpgt);
        return 0;
      }
      spent_inputs[as_indexer] = 1;
    }
  }
  spent_inputs = null;



  //////////////////////
  // validate locally //
  //////////////////////
  //
  // note that this is a different validation function from the one 
  // we use when checking the validity of transactions we are adding
  // to our mempool.
  //
  // the reason for this is that mempool transactions are not in our
  // hashmap (no block hash, etc.) and if we generated them locally
  // as part of Golden Tickets or Fee Transactions they will not have
  // information like BID or BHASH as the blocks that contain them 
  // have not been created yet.
  //
  for (var b = 0; b < newblock.transactions.length; b++) {
    for (var bb = 0; bb < newblock.transactions[b].transaction.from.length; bb++) {
      if (newblock.transactions[b].transaction.from[bb].amt > 0) {
        var slip_map_index = storage_self.returnHashmapIndex(newblock.transactions[b].transaction.from[bb].bid, newblock.transactions[b].transaction.from[bb].tid, newblock.transactions[b].transaction.from[bb].sid, newblock.transactions[b].transaction.from[bb].add, newblock.transactions[b].transaction.from[bb].amt, newblock.transactions[b].transaction.from[bb].bhash);

	// if we fail to validate the slip, we will permit it if
        // we do not have a full genesis period worth of blocks
        // as while this may lead us onto a poisoned chain, there
	// is no way to be sure until we have a full genesis block
        //
        // if this becomes a problem in practice, then we need to
	// maintain block hash records stretching back to the genesis
	// block, which will be unfortunate but allow a workaround
	// in the event of real issues here.
	//
        if (shashmap.validate_slip(slip_map_index, newblock.block.id) == 0) {

          if (newblock.transactions[b].transaction.from[bb].bid < storage_self.app.blockchain.blk_limit) {

            console.log("Validation Failure, but acceptable as we do not have a full genesis period yet");

          } else {

	    // while we are debugging, we stop execution here for
	    // the purpose of assisting with debugging. Once we are
	    // ready for production we can shift this to just return
	    // 0 and it will trigger a rewinding / resetting of the 
	    // chain to a formerly good position.
	    //
            console.log("FAILED TO VALIDATE SLIP: " + slip_map_index);
            console.log(JSON.stringify(newblock.transactions[b].transaction.from[bb], null, 4));
            console.log("MY GBID: " + storage_self.app.blockchain.blk_limit);
            //console.log("value: " + shashmap.slip_value(slip_map_index));
            return 0;

          }
        }
      }
    }
  }

  // block w/o transactions also valid
  return 1;

}


// if we have decided that a block has valid inputs, we spend its from slips
//
// this doesn't need to worry about txs with BID 0 etc. as they will all be 
// added to our hashmap with the specific block hash and block ID by this point
//
Storage.prototype.spendBlockInputs = function spendBlockInputs(newblock) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var storage_self = this;

  for (var b = 0; b < newblock.transactions.length; b++) {
    for (var bb = 0; bb < newblock.transactions[b].transaction.from.length; bb++) {
      if (newblock.transactions[b].transaction.from[bb].amt > 0) {
        var slip_map_index = storage_self.returnHashmapIndex(newblock.transactions[b].transaction.from[bb].bid, newblock.transactions[b].transaction.from[bb].tid, newblock.transactions[b].transaction.from[bb].sid, newblock.transactions[b].transaction.from[bb].add, newblock.transactions[b].transaction.from[bb].amt, newblock.transactions[b].transaction.from[bb].bhash);
        shashmap.insert_slip(slip_map_index, newblock.block.id);
      }
    }
  }

  return 1;
}







Storage.prototype.validateLongestChain = function validateLongestChain(newblock, pos, shared_ancestor_index_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, forceAdd) {

  var storage_self = this;

  // lite-client validation goes here. We really only care about the integrity of
  // the transactions we are monitoring, so we do not check the whole chain. In the 
  // future we should do merkle-root checks and put them here. As long as the 
  // general block data has been OK we just assume the transaction slips are OK since
  // we cannot verify them.
  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { 

    // we have to trust that the transaction slips are valid as we are not 
    // a full-node. In the future this can be replaced with merkle roots
    // etc. so that we can at least confirm our own transactions are valid

    for (x = 0; x < old_block_ids.length; x++) {
      storage_self.app.storage.onChainReorganization(old_block_ids[x], old_block_hashes[x], 0);
      storage_self.app.wallet.onChainReorganization(old_block_ids[x], old_block_hashes[x], 0);
      storage_self.app.modules.onChainReorganization(old_block_ids[x], old_block_hashes[x], 0);
    }

    // -1 as we handle the current block in addBlockToBlockchainPartTwo
    for (x = 0; x < new_block_ids.length-1; x++) {
      storage_self.app.storage.onChainReorganization(new_block_ids[x], new_block_hashes[x], 1);
      storage_self.app.wallet.onChainReorganization(new_block_ids[x], new_block_hashes[x], 1);
      storage_self.app.modules.onChainReorganization(new_block_ids[x], new_block_hashes[x], 1);
    }

    this.app.blockchain.addBlockToBlockchainPartTwo(newblock, pos, i_am_the_longest_chain, forceAdd);
    return; 

  }

  //console.log("\n\n\nWe need to validate the new chain: ");
  //console.log(JSON.stringify(new_block_hashes));
  //console.log(JSON.stringify(old_block_hashes));
  //console.log(shared_ancestor_index_pos);
  //console.log("\n\n");

  // unwind the old chain
  if (old_block_hashes.length > 0) {
    storage_self.unwindChain(newblock, pos, shared_ancestor_index_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, forceAdd, old_block_hashes.length-1, 0);
  } else {
    storage_self.windChain(newblock, pos, shared_ancestor_index_pos, new_block_idxs, new_block_hashes, new_block_ids, old_block_idxs, old_block_hashes, old_block_ids, i_am_the_longest_chain, forceAdd, 0, 0);
  }

}













////////////////////////
// Read from Database //
////////////////////////
Storage.prototype.indexRecentBlocks = function indexRecentBlocks(mylimit=0) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var storage_self = this;
      storage_self.reindexing_blocks = 1;

  var dir = storage_self.data_directory + "blocks/";
  var files = fs.readdirSync(dir);
  files.sort(function(a, b) {
    var compres = fs.statSync(dir + a).mtime.getTime() - fs.statSync(dir + b).mtime.getTime();
    // if exact same creation time... string compare on names to fetch lower ID
    if (compres == 0) {
      return parseInt(a) - parseInt(b);
    }
    return compres;
  });

  var current_block = 0;
  var max_block = files.length-1;

  storage_self.reindexing_timer = setInterval(function() {

    // do not repeat ourselves
    if (storage_self.reindexing_chunk == 1) { return; }
    if (storage_self.app.blockchain.mempool.blocks.length < 1) {

      if (files[current_block] == "empty") { current_block++; }

      if (current_block > max_block) {
        storage_self.reindexing_blocks = 0; 
	clearInterval(storage_self.reindexing_timer);
	return;
      }
      if (files.length == 0) {
        storage_self.reindexing_blocks = 0; 
        clearInterval(storage_self.reindexing_timer);
        return;
      }

      storage_self.reindexing_chunk = 1;

      try {
	storage_self.openBlockByFilename(files[current_block], function(storage_self, blk) {

	  var thisBlockId = files[current_block].substr(0, files[current_block].indexOf("-"));
	  var thisDatabaseId = files[current_block].substr(files[current_block].indexOf("-") + 1, files[current_block].indexOf(".")-files[current_block].indexOf("-")-1);

          blk.prevalidated  = 1; // force-add to index
                                // cannot be set through json
          blk.saveBlockId   = thisBlockId; // block_id
          blk.saveDatabaseId = thisDatabaseId; // id

          console.log("REPOPULATING: adding block to mempool w/ id: "+ blk.returnId() + " -- " + blk.returnHash());
          storage_self.app.blockchain.mempool.addBlock(blk);
          storage_self.app.blockchain.mempool.processBlocks();
	  current_block++;
          storage_self.reindexing_chunk = 0;

	});
      } catch (err) {}
    }
  });
}
Storage.prototype.reindexRecentBlocksChunk = function reindexRecentBlocksChunk(lowest_block_id) {

  var storage_self = this;

  // check the callback limit in the Blockchain Class -- we will need to keep 
  // these blocks in memory anyway, so if there are problems with their size
  // that will cause failures there.
  var cblimit = this.app.blockchain.callback_limit;

  var sql    = "SELECT * FROM blocks WHERE block_id >= $lowest_block_id AND reindexed = 0 ORDER BY block_id ASC LIMIT $blimit";
  var params = { $lowest_block_id : lowest_block_id , $blimit : 1 };

  this.db.all(sql, params, function (err, rows) {
    for (var sqlr = 0; sqlr < rows.length; sqlr++) {

      var block_json_id = rows[sqlr].block_json_id;
      var block_id      = rows[sqlr].block_id;
      var block_db_id   = rows[sqlr].id;

      var block_filename = block_id + "-" + block_db_id + ".blk";
      try {
	storage_self.openBlockByFilename(block_filename, function(storage_self, blk) {

          blk.prevalidated = 1; // force-add to index
                                // cannot be set through json

          console.log("REPOPULATING: adding block to mempool w/ id: "+ blk.returnId() + " -- " + blk.returnHash());
          storage_self.app.blockchain.mempool.addBlock(blk);
          storage_self.app.blockchain.mempool.processBlocks();
          storage_self.reindexing_chunk = 0;

          var sql2    = "UPDATE blocks SET reindexed = 1 WHERE block_id = $block_id AND hash = $block_hash";
          var params2 = {
            $block_id   : blk.returnId(),
            $block_hash : blk.returnHash()
          }
          storage_self.db.run(sql2, params2, function(err) {});
        });
      } catch (err) { console.log("Error reading block from disk"); }
    }
  });

}


/////////////////
// Send Blocks //
/////////////////
Storage.prototype.propagateMissingBlock = function propagateMissingBlock(hash, peer) {

  var sql = "SELECT * FROM blocks WHERE hash = $hash";
  var params = { $hash : hash};
  this.queryBlockchain(sql, params, function (err, row) {
    if (row != null) {
      if (row.block != null) {
        var response = {};
            response.request = "block";
            response.data = row.block;
            peer.socket.emit('request',JSON.stringify(response));
      }
    }
  });
}

Storage.prototype.sendBlockchain = function sendBlockchain(start_bid, synctype, peer) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var storage_self = this;

  peer.sync_sending_bid    = start_bid;
  peer.sync_latest_bid     = this.app.blockchain.returnLatestBlockId();
  peer.sync_sending_db_bid = 0;
  peer.sync_sending        = 1;

  peer.sync_timer = setInterval(function() {

    if (peer.isConnected() != 1) {
      clearInterval(peer.sync_timer);
      peer.sync_sending = 0;
      peer.sync_sending_chunk = 0;
      return false;
    }

    if (peer.message_queue.length >= storage_self.send_blocks_queue_limit) {
      return;
      //peer.sync_sending_chunk = 0;
    }

    if (peer.sync_sending_chunk == 1) { 
      return;
    }
    peer.sync_sending_chunk = 1;

    var sql    = "SELECT count(*) AS count FROM blocks WHERE block_id >= $block_id AND id > $db_id ORDER BY block_id, id ASC";
    var params = { $block_id : peer.sync_sending_bid , $db_id : peer.sync_sending_db_bid };

    storage_self.db.get(sql, params, function (err, rowz) {
      if (rowz != null) {
        var count = rowz.count;
        if (count > 0) {
	  if (peer.message_queue.length < storage_self.send_blocks_queue_limit) {
            storage_self.sendBlockchainChunk(peer);
	  }
        } else {
	  clearInterval(peer.sync_timer);
	  peer.sync_sending = 0;
	  peer.sync_sending_chunk = 0;
	}
      } else {
	clearInterval(peer.sync_timer);
	peer.sync_sending_chunk = 0;
	peer.sync_sending = 0;
      }
    });
  }, peer.sync_timer_speed);

}
Storage.prototype.sendBlockchainChunk = function sendBlockchainChunk(peer) {

  var storage_self = this;

  // send limit = this.send_block_queue_limit
  var sql    = "SELECT * FROM blocks WHERE blocks.block_id >= $block_id AND blocks.id >= $db_id ORDER BY block_id, id ASC LIMIT $db_limit";
  var params = { $block_id : peer.sync_sending_bid , $db_id : peer.sync_sending_db_bid , $db_limit : storage_self.send_blocks_queue_limit };

  this.app.storage.queryBlockchainArray(sql, params, function (err, rows) {

    if (rows == null) { 
      peer.sync_sending = 0; 
      peer.sync_sending_chunk = 0; 
      clearInterval(peer.sync_timer);
      return; 
    }
    for (var r = 0; r < rows.length; r++) {

      peer.sync_sending_db_bid = rows[r].id;
      peer.sync_sending_bid    = rows[r].block_id;
 
      var block_filename = rows[r].block_id + "-" + rows[r].id + ".blk";
      try {
        storage_self.openBlockByFilename(block_filename, function(storage_self, tmpblk) {
          peer.sendBlock("block", tmpblk);
          peer.sync_sending_chunk = 0;
        });
      } catch (err) { 
	console.log("Error reading block from disk"); 
        peer.sync_sending_chunk = 0;
        peer.sync_sending = 0;
        console.log("Error Reading Block File");
      }
    }
    if (peer.isConnected() != 1) {
      peer.sync_sending = 0; 
      peer.sync_sending_chunk = 0; 
      clearInterval(peer.sync_timer);
      return; 
    }
  });
}
Storage.prototype.returnHashmapIndex = function returnHashmapIndex(bid, tid, sid, add, amt, block_hash) {
  return bid.toString() + tid.toString() + sid.toString() + block_hash + amt;
}
Storage.prototype.openBlockByHash = function openBlockByHash(block_hash, mycallback) {

  var storage_self = this;

  var sql    = "SELECT * FROM blocks WHERE hash = $block_hash";
  var params = { $block_hash : block_hash };

  this.db.all(sql, params, function (err, rows) {
    if (rows.length > 0) {

      var block_json_id = rows[0].block_json_id;
      var block_id      = rows[0].block_id;
      var block_db_id   = rows[0].id;
      var blkjson       = "";

      var block_filename  = rows[0].block_id + "-" + rows[0].id + ".blk";
      storage_self.openBlockByFilename(block_filename, mycallback);

    }
  });
}
Storage.prototype.openBlockByFilename = function openBlockByFilename(filename, mycallback) {

  var storage_self = this;

  var block_filename  = filename;
  var block_filename2 = storage_self.data_directory + "blocks/" + filename;

  try {
    fs.readFile(block_filename2, 'utf8', (err, data) => {
      var blk = new saito.block(storage_self.app, data);
      mycallback(storage_self, blk);
    });
  } catch (err) { console.log("Error reading block from disk"); }

}
// return 1 if slip is spent
Storage.prototype.isSpent = function isSpent(slip) {
  var slip_map_index = this.returnHashmapIndex(slip.bid, slip.tid, slip.sid, slip.add, slip.amt, slip.bhash);
  return shashmap.validate_slip_spent(slip_map_index);
}
Storage.prototype.returnShashmapValue = function returnShashmapValue(slip) {
  var slip_map_index = this.returnHashmapIndex(slip.bid, slip.tid, slip.sid, slip.add, slip.amt, slip.bhash);
  return shashmap.return_value(slip_map_index);
}
Storage.prototype.writeToLog = function writeToLog(msg) {

  fs.writeFile("data/log.txt", msg, function(err) {
    if (err) {
      console.log(err);
    }
  });

}






// differs from deleteBlocks as it handles ZIP file and clears slip hashmap
// deleteBlocks just takes care of the database
Storage.prototype.purgeBlockStorage = function purgeBlockStorage(block_hash) {

  var storage_self = this;

  this.openBlockByHash(block_hash, function(blk) {

    // outer index implicity checks if any txs exists (i.e. blk1 does not have them)
    if (blk.transactions != undefined) {
      for (var b = 0; b < blk.transactions.length; b++) {
        for (var bb = 0; bb < blk.transactions[b].to.length; bb++) {
          var slip_map_index = storage_self.returnHashmapIndex(blk.block.id, blk.transactions[b].transaction.id, blk.transactions[b].transaction.to[bb].sid, blk.transactions[b].transaction.to[bb].add, blk.transactions[b].transaction.to[bb].amt, block_hash);
          shashmap.delete_slip(slip_map_index);
        }
      }
    }
    storage_self.deleteZipByHash(block_hash);

  });

}



Storage.prototype.deleteZipByHash = function deleteZipByHash(block_hash) {

  var storage_self = this;

  var sql    = "SELECT * FROM blocks WHERE hash = $block_hash";
  var params = { $block_hash : block_hash };

  this.db.all(sql, params, function (err, rows) {
    if (rows.length > 0) {

      var block_json_id = rows[0].block_json_id;
      var block_id      = rows[0].block_id;
      var block_db_id   = rows[0].id;

      var block_filename  = rows[0].block_id + "-" + rows[0].id + ".blk";
      var block_filename2 = storage_self.data_directory + "blocks/" + rows[0].block_id + "-" + rows[0].id + ".blk.zip";

      fs.unlink(block_filename2, function(error) {
        if (error) {
          console.log("\nERROR: cannot delete ZIP file");
        }
        storage_self.deleteBlocks(block_id);


      });

    }
  });


}






