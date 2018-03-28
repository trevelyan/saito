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
  for (var b = 0; b < blk.transactions.length; b++) {
    for (var bb = 0; bb < blk.transactions[b].transaction.to.length; bb++) {
      if (blk.transactions[b].transaction.to[bb].amt > 0) {
        var slip_map_index = storage_self.returnHashmapIndex(blk.block.id, blk.transactions[b].transaction.id, blk.transactions[b].transaction.to[bb].sid, blk.transactions[b].transaction.to[bb].add, blk.transactions[b].transaction.to[bb].amt, blk.returnHash());
        shashmap.insert_slip(slip_map_index, -1);
      }
    }

    for (var bb = 0; bb < blk.transactions[b].transaction.from.length; bb++) {
      if (blk.transactions[b].transaction.from[bb].amt > 0) {
        var slip_map_index = storage_self.returnHashmapIndex(blk.transactions[b].transaction.from[bb].bid, blk.transactions[b].transaction.from[bb].tid, blk.transactions[b].transaction.from[bb].sid, blk.transactions[b].transaction.from[bb].add, blk.transactions[b].transaction.from[bb].amt, blk.transactions[b].transaction.from[bb].bhash);
        if (shashmap.validate_slip(slip_map_index, blk.block.id) == 0) {
	  console.log("FAILUED TO VALIDATE SLIP: " + slip_map_index);
          console.log(JSON.stringify(blk.transactions[b].transaction.from[bb], null, 4));
	  console.log("value: " + shashmap.slip_value(slip_map_index));
          process.exit(0);
          return 0;

        }
        shashmap.insert_slip(slip_map_index, blk.block.id);
      }
    }
  }

  var mintxid = 0;
  var maxtxid = 0;

  if (blk.transactions.length > 0) {
    mintx = JSON.parse(blk.block.transactions[0]);
    maxtx = JSON.parse(blk.block.transactions[blk.block.transactions.length-1]);
    maxtxid = maxtx.id;
    mintxid = mintx.id;
  }

  var blkjson = JSON.stringify(blk.block);


  //////////////////
  // SAVE TO DISK //
  //////////////////
  var sql2 = "INSERT INTO blocks (block_id, reindexed, block_json_id, hash, conf, longest_chain, min_tx_id, max_tx_id) VALUES ($block_id, 1, $block_json_id, $hash, 0, $lc, $mintxid, $maxtxid)";
  storage_self.db.run(sql2, {
    $block_id: blk.block.id,
    $block_json_id : 0,
    $hash: blk.returnHash(),
    $lc: lc,
    $mintxid: mintxid,
    $maxtxid: maxtxid
  }, function(err) {

    // if undefined, then we have had insert problem, do not save to disk
    if (this.lastID != undefined) {

      /////////////////////
      // MOVE DOWNLOADED //
      /////////////////////
      if (blk.tmp_filename != "") {

        var source_file = storage_self.data_directory + "/tmp/" + blk.tmp_filename;
        blk.pmt_filename = blk.block.id + "-" + this.lastID + ".blk.zip";
        var dest_file   = storage_self.data_directory + "/blocks/" + blk.pmt_filename;

        mv(source_file, dest_file, function(err) {
          storage_self.saving_blocks = 0;

	  for (var x = 0; x < storage_self.app.blockchain.mempool.downloads.length; x++) {
	    if (storage_self.app.blockchain.mempool.downloads[x].save_file == source_file) {
	      storage_self.app.blockchain.mempool.downloads[x].moved = 1;
	    }
          }

        });


      /////////////////////
      // or SAVE TO DISK //
      /////////////////////
      } else {

        blk.pmt_filename    = blk.block.id + "-" + this.lastID + ".blk.zip";
        var block_filename2 = storage_self.data_directory + "blocks/" + blk.pmt_filename;
        var block_filename3 = blk.block.id + "-" + this.lastID + ".blk";

        // write file if it does not exist
        if ( ! fs.existsSync(block_filename2)) {
          var zip             = new require('node-zip')();
          zip.file(block_filename3, blkjson);
          var data = zip.generate({base64:false,compression:'DEFLATE'});
          fs.writeFileSync(block_filename2, data, 'binary');

	  // example of how we may compress
          //var block_filename4 = storage_self.data_directory + "blocks/" + blk.block.id + "-sa.segadd";
	  //blk.compressSegAdd();
          //fs.writeFileSync(block_filename4, JSON.stringify(blk.block), 'binary');

        }

        // simulate mempool fetch block
        var save_filename = block_filename3 + ".zip";
        var bhash = blk.returnHash();
        var mypeer = new saito.peer();
        storage_self.app.blockchain.mempool.fetchBlock(mypeer, save_filename, bhash);

        storage_self.saving_blocks = 0;
      }
    } else {
        storage_self.saving_blocks = 0;
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
Storage.prototype.saveLongestChainStatus = function saveLongestChainStatus(block_hash, block_id, lc) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var storage_self = this;

  storage_self.app.blockchain.hashmap[block_hash] = lc;

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

  this.processBlock(block_hash, function(storage_self, blk) {
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
        var slip_map_index = storage_self.returnHashmapIndex(bid, tid, sid, add, amt, block_hash);
        var tmpval = storage_self.spent_hashmap[slip_map_index];
        if ((tmpval === 0 && tmpval != undefined) || tmpval == 1) {
	  if (lc == 0) {
	    storage_self.spent_hashmap[slip_map_index] = 0;
	  } else {
	    storage_self.spent_hashmap[slip_map_index] = bid;
	  }
        }
      }
    }
  });
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






//////////////////////////////////
// Transaction Input Validation //
//////////////////////////////////
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
Storage.prototype.validateBlockInputs = function validateBlockInputs(myblk, old_lc, lc_len, blocks_to_validate_sequentially, forceAdd="no", am_i_child = 0, child_number = 0, max_children = 0) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var storage_self = this;
  var spent_inputs = [];


  /////////////////////////////////////////
  // check against double-input spending //
  /////////////////////////////////////////
  var tmpgtfound = 0;
  var tmpftfound = 0;
  for (var ti = 0; ti < myblk.transactions.length; ti++) {
    var tx = myblk.transactions[ti];
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
          this.app.blockchain.addBlockToBlockchainFailure(myblk, tx, old_lc, lc_len);
	  return 0;
	} else {
	  tmpftfound = 1;
	}
      }

      // we can have multiple golden ticket-tagged sources in the block, but the BID/SID/TID will differ
      var as_indexer = "a"+tmpbid+"-"+tmptid+"-"+tmpsid+"-"+tmpgt;
      if (spent_inputs[as_indexer] == 1) {
        console.log("Block invalid: multiple transactions spend same input: "+tmpbid+"/"+tmptid+"/"+tmpsid+"/"+tmpgt);
        this.app.blockchain.addBlockToBlockchainFailure(myblk, tx, old_lc, lc_len);
        return 0;
      }
      spent_inputs[as_indexer] = 1;
    }
  }
  spent_inputs = null;



  if (blocks_to_validate_sequentially == 1) {

    this.slips_to_validate = 0;
    this.slips_validated   = 0;

    //////////////////////
    // validate locally //
    //////////////////////
    for (var x = 0; x < myblk.transactions.length; x++) {
      this.slips_to_validate += myblk.transactions[x].transaction.from.length;
    }

    for (var x = 0; x < myblk.transactions.length; x++) {
      for (var y = 0; y < myblk.transactions[x].transaction.from.length; y++) {

	////////////////////////
	// validate 0-payment //
	////////////////////////
	if (myblk.transactions[x].transaction.from[y].amt == 0) { 
	  this.slips_validated++; 
        } else {

          if (myblk.transactions[x].transaction.from[y].amt == 0 && myblk.transactions[x].transaction.from[y].bid == 0 && myblk.transactions[x].transaction.from[y].tid == 0 && myblk.transactions[x].transaction.from[y].sid == 0 && (myblk.transactions[x].transaction.from[y].gt == 1 || myblk.transactions[x].transaction.from[y].ft == 1)) { 
	    this.slips_validated++;
	  } else {

	    //////////////////////
	    // validate hashmap //
	    //////////////////////
            var slip_map_index = storage_self.returnHashmapIndex(myblk.transactions[x].transaction.from[y].bid, myblk.transactions[x].transaction.from[y].tid, myblk.transactions[x].transaction.from[y].sid, myblk.transactions[x].transaction.from[y].add, myblk.transactions[x].transaction.from[y].amt, myblk.transactions[x].transaction.from[y].bhash);
	    if (shashmap.validate_slip(slip_map_index, myblk.block.id) == 1) {
              storage_self.slips_validated++;
	      if (storage_self.slips_validated == storage_self.slips_to_validate) {
	        storage_self.app.blockchain.addBlockToBlockchainSuccess(storage_self.app, null, myblk, forceAdd);
	        return;
	      }
	    } else {
	      storage_self.app.blockchain.addBlockToBlockchainFailure(myblk, null, old_lc, lc_len)
	      x = myblk.transactions.length;
	      return;
	    }
	  } 
        }
      }

      if (storage_self.slips_validated == storage_self.slips_to_validate) {
	storage_self.app.blockchain.addBlockToBlockchainSuccess(storage_self.app, null, myblk, forceAdd);
        return;
      }
    }
  } else {

    //////////////////////////////////////////////
    // more than 1 block to handle sequentially //
    //////////////////////////////////////////////
    max_block_id = myblk.returnId();
    min_block_id = max_block_id - (blocks_to_validate_sequentially-0);

    var sql = "SELECT * FROM blocks WHERE block_id >= $min_block_id AND block_id <= $max_block_id AND longest_chain = 1 ORDER BY block_id ASC";
    var params = {
      $min_block_id : min_block_id,
      $max_block_id : max_block_id
    }

    // we add the transactions to our temporary hashmap as we
    // "spend" them and if there is a collision that means that
    // someone is trying to spend the same input twice and we 
    // report back with failure.
    var doublespend_hashmap = [];

    // this needs to be updated so it does what chain_hashes was supposed
    // to do when we had a DB -- check to make sure the slip is not spent
    // in an EARLIER block created as part of this chain reorganization
    //
    // otherwise blocks can spend the same slip as long as they are 
    // moved into LC at the same time.
    //
    storage_self.queryBlockchainArray(sql, params, function (err, rows) {

      if (rows.length == 0) {
        storage_self.app.blockchain.addBlockToBlockchainSuccess(storage_self.app, null, tmpblk, forceAdd);
        return;
      } else {

        var blocks_to_validate = rows.length;  
	var blocks_validated   = 0;

        for (var sqlr = 0; sqlr < rows.length; sqlr++) {

          var block_filename = rows[sqlr].block_id +  "-" + rows[sqlr].id + ".blk";
          try {
	    storage_self.openBlockByZipFilename(files[current_block], function(storage_self, tmpblk) {

	      tmpblk.slips_to_validate = 0;

              for (var x = 0; x < tmpblk.transactions.length; x++) {
                tmpblk.slips_to_validate += tmpblk.transactions[x].transaction.from.length;
              }
	      tmpblk.slips_validated = 0;
	      tmpblk.block_fully_validated = 0;


              for (var sql2r = 0; sql2r < tmpblk.transactions.length; sql2r++) {
                for (var y = 0; y < tmpblk.transactions[sql2r].transaction.from.length; y++) {

                  ////////////////////////
                  // validate 0-payment //
                  ////////////////////////
                  if (tmpblk.transactions[sql2r].transaction.from[y].amt == 0) {
                    tmpblk.slips_validated++;
                  } else {

                    if (tmpblk.transactions[sql2r].transaction.from[y].amt == 0 && tmpblk.transactions[sql2r].transaction.from[y].bid == 0 && tmpblk.transactions[sql2r].transaction.from[y].tid == 0 && tmpblk.transactions[sql2r].transaction.from[y].sid == 0 && (tmpblk.transactions[sql2r].transaction.from[y].gt == 1 || tmpblk.transactions[sql2r].transaction.from[y].ft == 1)) {
                      tmpblk.slips_validated++;
                    } else {

                      //////////////////////
                      // validate hashmap //
                      //////////////////////
                      var slip_map_index = storage_self.returnHashmapIndex(tmpblk.transactions[sql2r].transaction.from[y].bid, tmpblk.transactions[sql2r].transaction.from[y].tid, tmpblk.transactions[sql2r].transaction.from[y].sid, tmpblk.transactions[sql2r].transaction.from[y].add, tmpblk.transactions[sql2r].transaction.from[y].amt, tmpblk.transactions[sql2r].transaction.from[y].bhash);
                      if (shashmap.validate_slip(slip_map_index, tmpblk.block.id) == 1) {
                        tmpblk.slips_validated++;

			// doublecheck we are not doublespending with our temporary hashmap too
			if (doublespend_hashmap[slip_map_index] == 1) {
                          storage_self.app.blockchain.addBlockToBlockchainFailure(tmpblk, null, old_lc, lc_len)
                          return;
			}
			doublespend_hashmap[slip_map_index] = 1;

                        if (tmpblk.slips_validated >= tmpblk.slips_to_validate && tmpblk.block_fully_validated != 1) {
			  tmpblk.block_fully_validated = 1;
			  blocks_validated++;
			  if (blocks_validated >= blocks_to_validate) {
                            storage_self.app.blockchain.addBlockToBlockchainSuccess(storage_self.app, null, tmpblk, forceAdd);
                            return;
			  }
                        }
                      } else {
                        storage_self.app.blockchain.addBlockToBlockchainFailure(tmpblk, null, old_lc, lc_len)
                        return;
                      }
                    }
                  }
		}
              }

	      ////////////////////////
	      // check if validated //
	      ////////////////////////
	      if (tmpblk.slips_validated >= tmpblk.slips_to_validate && tmpblk.block_fully_validated != 1) {
                tmpblk.block_fully_validated = 1;
                blocks_validated++;
                if (blocks_validated >= blocks_to_validate) {
                  storage_self.app.blockchain.addBlockToBlockchainSuccess(storage_self.app, null, tmpblk, forceAdd);
                  return;
                } 
              } 

            }); 
          } catch (err) {}
        }
      }
    });
  }

  return 1;
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
	storage_self.openBlockByZipFilename(files[current_block], function(storage_self, blk) {

	  var thisBlockId = files[current_block].substr(0, files[current_block].indexOf("-"));

          blk.prevalidated = 1; // force-add to index
                                // cannot be set through json
          blk.saveBlockId = thisBlockId; // id

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

      var block_filename = block_id + "-" + block_db_id + ".blk.zip";
      try {
	storage_self.openBlockByZipFilename(block_filename, function(storage_self, blk) {

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
 

      var block_filename = rows[r].block_id + "-" + rows[r].id + ".blk.zip";
      try {
        storage_self.openBlockByZipFilename(block_filename, function(storage_self, tmpblk) {
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
      var block_filename2 = storage_self.data_directory + "blocks/" + rows[0].block_id + "-" + rows[0].id + ".blk.zip";

console.log("OPENING FILE: " + block_filename2);

      try {
        fs.createReadStream(block_filename2).pipe(unzip.Parse()).on('entry', function (entry) {
          var fileName = entry.path;
          var type = entry.type; // 'Directory' or 'File'
          var size = entry.size;
          if (fileName === block_filename) {
            entry.on('data', function(chunk) {
              blkjson += chunk;
            });
            entry.on('end', function() {
              storage_self.openBlockManageCallback(blkjson, mycallback);
            });
          } else {
            entry.autodrain();
          }
        });
      } catch (err) { console.log("Error reading block from disk"); }
    }
  });
}
Storage.prototype.openBlockByFilename = function openBlockByFilename(filename, mycallback) {

  var storage_self = this;

  var block_filename  = filename;
  var block_filename2 = storage_self.data_directory + "blocks/" + filename + ".zip";
  var blkjson = "";

  try {
    fs.createReadStream(block_filename2).pipe(unzip.Parse()).on('entry', function (entry) {
      var fileName = entry.path;
      var type = entry.type; // 'Directory' or 'File'
      var size = entry.size;
      if (fileName === block_filename) {
        entry.on('data', function(chunk) {
          blkjson += chunk;
        });
        entry.on('end', function() {
          storage_self.openBlockManageCallback(blkjson, mycallback);
        });
      } else {
        entry.autodrain();
      }
    });
  } catch (err) { console.log("Error reading block from disk"); }
}
Storage.prototype.openBlockByZipFilename = function openBlockByZipFilename(zip_filename, mycallback) {

  var storage_self = this;

  if (zip_filename.length < 4) { return; }

  var block_filename  = zip_filename.substr(0, zip_filename.length-4);;
  var block_filename2 = storage_self.data_directory + "blocks/" + zip_filename;
  var blkjson = "";

  try {
    fs.createReadStream(block_filename2).pipe(unzip.Parse()).on('entry', function (entry) {
      var fileName = entry.path;
      var type = entry.type; // 'Directory' or 'File'
      var size = entry.size;
      if (fileName === block_filename) {
        entry.on('data', function(chunk) {
          blkjson += chunk;
        });
        entry.on('end', function() {
          storage_self.openBlockManageCallback(blkjson, mycallback);
        });
      } else {
        entry.autodrain();
      }
    });
  } catch (err) { console.log("Error reading block from disk"); }
}
Storage.prototype.openBlockByTmpZipFilename = function openBlockByTmpZipFilename(zip_filename, orig_filename, mycallback) {

  var storage_self = this;

  if (zip_filename.length < 4) { return; }

  var block_filename  = orig_filename.substr(0, orig_filename.length-4);
  var block_filename2 = storage_self.data_directory + "/tmp/" + zip_filename;
  var blkjson = "";

  try {
    fs.createReadStream(block_filename2).pipe(unzip.Parse()).on('entry', function (entry) {
      var fileName = entry.path;
      var type = entry.type; // 'Directory' or 'File'
      var size = entry.size;
      if (fileName === block_filename) {
        entry.on('data', function(chunk) {
          blkjson += chunk;
        });
        entry.on('end', function() {
          storage_self.openBlockManageCallback(blkjson, mycallback);
        });
      } else {
        entry.autodrain();
      }
    });
  } catch (err) { console.log("Error reading block from disk"); }
}
Storage.prototype.openBlockManageCallback = function openBlockManageCallback(blkjson, mycallback) {
  var storage_self = this;
  var blk = new saito.block(storage_self.app, blkjson);
  mycallback(storage_self, blk);
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






