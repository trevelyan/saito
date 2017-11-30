var saito   = require('../saito');
var fs      = require('fs');


/////////////////
// Constructor //
/////////////////
function Storage(app) {
  if (!(this instanceof Storage)) {
    return new Storage(app);
  }

  this.app  = app || {};

  this.delete_old_data            = 1; // do we delete old blocks / slips / txs

  this.reindexing_blocks          = 0;
  this.reindexing_chunk           = 0;
  this.reindexing_timer           = null;
  this.reindexing_speed           = 500; // 0.5 seconds (add blocks)

  return this;  

}
module.exports = Storage;



////////////////
// Initialize //
////////////////
Storage.prototype.initialize = function initialize() {

  if (this.app.BROWSER == 0) {
    var sqlite3 = require('sqlite3').verbose();
    this.db = new sqlite3.Database('./data/database.sq3');
    this.createDatabaseTables();
  }

  this.loadOptions();

}



/////////////
// Options //
/////////////
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
Storage.prototype.saveOptions = function saveOptions(reset = 0) {

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
    if (this.app.blockchain.returnLatestBlockId() > this.app.options.blockchain.lastblock) {
      this.app.options.blockchain.lastblock = this.app.blockchain.returnLatestBlockId();
      this.app.options.blockchain.fork_id   = this.app.blockchain.returnForkId();
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

    this.app.wallet.resetWallet();
    this.app.archives.resetArchives();

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



/////////////////////////
// Database Management //
/////////////////////////
Storage.prototype.createDatabaseTables = function createDatabaseTables() {

  if (this.app.BROWSER == 1) { return; }

  var storage_self = this;

  this.execDatabase("\
        CREATE TABLE IF NOT EXISTS blocks (\
                id INTEGER, \
                reindexed INTEGER, \
                block_id INTEGER, \
                block TEXT, \
                hash TEXT, \
                conf INTEGER, \
                longest_chain INTEGER, \
                UNIQUE (block), \
                PRIMARY KEY(id ASC) \
        )", 
	{}, 
	function() {
 	   	storage_self.app.storage.execDatabase("CREATE INDEX blocks_idx ON blocks (block_id, longest_chain)", {}, function() {});
 	   	storage_self.app.storage.execDatabase("CREATE INDEX blocks_idx2 ON blocks (reindexed)", {}, function() {});
 	   	storage_self.app.storage.execDatabase("CREATE INDEX blocks_idx3 ON blocks (hash)", {}, function() {});
 	}
  );



  this.execDatabase("\
        CREATE TABLE IF NOT EXISTS txs (\
                id INTEGER, \
                block_id INTEGER, \
                tx_id INTEGER, \
                tx TEXT, \
                block_hash TEXT, \
                longest_chain INTEGER, \
                UNIQUE (tx), \
                PRIMARY KEY(id ASC) \
        )",
	{},
	function() {
 	   	storage_self.app.storage.execDatabase("CREATE INDEX txs_idx ON txs (block_id, block_hash)", {}, function() {});
	}
  );


  this.execDatabase("\
        CREATE TABLE IF NOT EXISTS slips (\
                id INTEGER, \
                block_id INTEGER, \
                tx_id INTEGER, \
                slip_id INTEGER, \
                block_hash TEXT, \
                longest_chain INTEGER, \
                golden_ticket INTEGER, \
                fee_ticket INTEGER, \
                slip_json TEXT, \
                address TEXT, \
                amount NUMERIC, \
                spent INTEGER, \
                UNIQUE (slip_json, block_hash, block_id, tx_id, slip_id), \
                PRIMARY KEY(id ASC) \
        )",
	{},
	function() {
 	   	storage_self.app.storage.execDatabase("CREATE INDEX slips_idx ON slips (longest_chain, block_id, tx_id, slip_id)", {}, function() {});
 	   	storage_self.app.storage.execDatabase("CREATE INDEX slips_idx2 ON slips (address)", {}, function() {});
 	   	storage_self.app.storage.execDatabase("CREATE INDEX slips_idx3 ON slips (spent)", {}, function() {});
	}
  );

}



///////////////////
// Longest Chain //
///////////////////
Storage.prototype.saveLongestChainStatus = function saveLongestChainStatus(block_hash, block_id, lc) {

  console.log("ENTERED saveLongestChainStatus for "+block_hash+" ("+block_id+") "+lc);

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var storage_self = this;

  // blocks
  var sql = "UPDATE blocks SET longest_chain = $lc WHERE block_id = $block_id AND hash = $block_hash";
  this.db.run(sql, {
    $block_id: block_id,
    $block_hash: block_hash,
    $lc: lc
  }, function(err) {
  });

  // transactions
  var sql2 = "UPDATE txs SET longest_chain = $lc WHERE block_id = $block_id AND block_hash = $block_hash";
  this.db.run(sql2, {
    $block_id: block_id,
    $block_hash: block_hash,
    $lc: lc
  }, function(err) {
  });

  // slips
  var sql3 = "UPDATE slips SET longest_chain = $lc WHERE block_id = $block_id AND (block_hash = $block_hash OR golden_ticket = 1 OR fee_ticket = 1)";
  if (lc == 0) {
    sql3   = "UPDATE slips SET longest_chain = $lc, spent = 0 WHERE block_id = $block_id AND (block_hash = $block_hash OR golden_ticket = 1 OR fee_ticket = 1)";
  }
  this.db.run(sql3, {
    $block_id: block_id,
    $block_hash: block_hash,
    $lc: lc
  }, function(err) {
  });


  // slips within this transaction
  var sql4 = "SELECT * FROM txs WHERE block_id = $block_id AND block_hash = $block_hash";
  var params4 = {
    $block_id: block_id,
    $block_hash: block_hash,
  };
  this.queryBlockchainArray(sql4, params4, function(err, rows) {
    for (var sqlr = 0; sqlr < rows.length; sqlr++) {
      var tmptx = new saito.transaction(rows[sqlr].tx);
      for (var tti = 0; tti < tmptx.transaction.from.length; tti++) {

        var bhash = tmptx.transaction.from[tti].bhash;
        var bid   = tmptx.transaction.from[tti].bid;
        var tid   = tmptx.transaction.from[tti].tid;
        var sid   = tmptx.transaction.from[tti].sid;

	if (lc == 0) {
	  var sql5 = "UPDATE slips SET spent = 0 WHERE block_id = $block_id AND tx_id = $tx_id AND slip_id = $slip_id";
      	  var params5 =  {
	    $block_hash: bhash,
	    $block_id: bid,
	    $tx_id: tid,
	    $slip_id: sid
	  };
          storage_self.db.run(sql5, params5, function(err) { });
        }

        if (lc == 1) {
	  var sql6 = "UPDATE slips SET spent = $block_spent WHERE block_hash = $block_hash AND block_id = $block_id AND tx_id = $tx_id AND slip_id = $slip_id";
          var params6 =  {
	    $block_spent : block_id,
	    $block_hash : bhash,
	    $block_id: bid,
	    $tx_id: tid,
	    $slip_id: sid
          }
          storage_self.db.run(sql6, params6, function(err) { });
        }
      }
    }
  });
}
Storage.prototype.saveBlock = function saveBlock(blk, lc = 0) {

  if (this.app.BROWSER == 1) { return; }

  var sql = "INSERT OR IGNORE INTO blocks (block_id, reindexed, block, hash, conf, longest_chain) VALUES ($block_id, 1, $block, $hash, 0, $lc)";
  this.db.run(sql, {
    $block_id: blk.block.id,
    $block: JSON.stringify(blk.block),
    $hash: blk.hash('hex'),
    $lc: lc
  }, function(err) {
  });

  for (var b = 0; b < blk.transactions.length; b++) {
    this.saveTransaction(blk.block.id, blk.transactions[b], blk.hash(), lc);
  }

}
Storage.prototype.saveTransaction = function saveTransaction(block_id, tx, block_hash, lc=0) {

  if (this.app.BROWSER == 1) { return; }
  var sql = "INSERT OR IGNORE INTO txs (block_id, block_hash, tx_id, tx, longest_chain) VALUES ($block_id, $block_hash, $tx_id, $tx, $lc)";
  this.db.run(sql, {
    $block_id: block_id,
    $block_hash: block_hash,
    $tx_id: tx.transaction.id,
    $tx: JSON.stringify(tx.transaction),
    $lc: lc
  }, function(err) {
  });

  for (var bb = 0; bb < tx.transaction.to.length; bb++) {
    this.saveSlip(block_id, tx.transaction.id, bb, JSON.stringify(tx.transaction.to[bb]), tx.transaction.to[bb], block_hash, lc);
  }
  for (var bba = 0; bba < tx.transaction.from.length; bba++) {
    this.spendSlip(block_id, tx.transaction.from[bba].bid, tx.transaction.from[bba].tid, tx.transaction.from[bba].sid, tx.transaction.from[bba].add, tx.transaction.from[bba].bhash);
  }

}
Storage.prototype.saveSlip = function saveSlip(block_id, tx_id, slip_id, slip_json, slip, bhash, lc) {

  if (this.app.BROWSER == 1) { return; }

  var sql = "INSERT OR IGNORE INTO slips (block_id, tx_id, slip_id, slip_json, golden_ticket, fee_ticket, address, amount, block_hash, longest_chain, spent) VALUES ($block_id, $tx_id, $slip_id, $slip_json, $golden_ticket, $fee_ticket, $address, $amount, $bhash, $lc, $spent)";
  var params = {
    $block_id: block_id,
    $tx_id: tx_id,
    $slip_id: slip_id,
    $slip_json: slip_json,
    $golden_ticket: slip.gt,
    $fee_ticket: slip.ft,
    $address: slip.add,
    $amount: slip.amt,
    $bhash: bhash,
    $lc: lc,
    $spent: 0
  };
  this.execDatabase(sql, params, function(err) {});

}
Storage.prototype.spendSlip = function spendSlip(spending_block_id, block_id, tx_id, slip_id, address, block_hash) {

  if (this.app.BROWSER == 1) { return; }

  var sql = "UPDATE slips SET spent = $spent_block_id WHERE block_hash = $block_hash AND block_id = $block_id AND tx_id = $tx_id AND slip_id = $slip_id AND address = $address";
  var params = {
    $spent_block_id : spending_block_id,
    $block_hash   : block_hash,
    $block_id   : block_id,
    $tx_id      : tx_id,
    $slip_id    : slip_id,
    $address    : address
  }
  this.execDatabase(sql, params, function(err) {});

}
Storage.prototype.saveConfirmation = function saveConfirmation(hash, conf) {

  if (this.app.BROWSER == 1) { return; }

  var sql = "UPDATE blocks SET conf = $conf WHERE hash = $hash";
  this.db.run(sql, {
    $conf: conf,
    $hash: hash
  });

}



//////////////////////////
// Delete from Database //
/////////////////////////
Storage.prototype.deleteBlocks = function deleteBlocks(block_id) {

  // browser apps dump old data
  if (this.app.BROWSER == 1) { return; }

  var sql1 = "DELETE FROM blocks WHERE block_id < $block_id";
  console.log("DELETE FROM blocks WHERE block_id < "+block_id);
  this.db.run(sql1, {
    $block_id: block_id
  });

  var sql2 = "DELETE FROM txs WHERE block_id < $block_id";
  this.db.run(sql2, {
    $block_id: block_id
  });

  var sql3 = "DELETE FROM slips WHERE block_id < $block_id";
  this.db.run(sql3, {
    $block_id: block_id
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
Storage.prototype.validateInputsWithDualCallbacks = function validateInputsWithDualCallbacks(blk, tx, spent_block_id, unacceptable_block_hashes_sql_list, old_lc, lc_len, forceAdd, success_callback, failure_callback, forceAdd) {

  var storage_self = this;

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { success_callback(storage_self.app, tx, blk, forceAdd); return; }

  var sql    = "";
  var sql_error = "";
  var params = {};
  var utxiarray = tx.transaction.from;
  var gtnum = 0;

  for (var via = 0; via < utxiarray.length; via++) {

    var utxi  = utxiarray[via];

    if (utxi.amt == 0 && utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && (utxi.gt == 1 || utxi.ft == 1)) { gtnum++; } else {
      if (sql == "") {
        sql       = "SELECT count(*) AS count FROM slips WHERE (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND (spent = 0 OR spent = "+parseInt(blk.returnId())+") AND address = \""+utxi.add+"\") ";
      } else {
        sql    = sql + " OR (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND (spent = 0 OR spent = "+parseInt(blk.returnId())+") AND address = \""+utxi.add+"\") ";
      }
    }
  }


  // if we have only golden ticket inputs
  if (gtnum == utxiarray.length) { success_callback(storage_self.app, tx, blk, forceAdd); return; }

  this.queryBlockchain(sql, params, function (err, row) {
    if (row != null) {
      if (row.count > 0) {
        if ((row.count+gtnum) == utxiarray.length) {
          success_callback(storage_self.app, tx, blk, forceAdd);
        } else {
          storage_self.queryBlockchainArray(sql_error, params, function (err, rows) {
	  });
          failure_callback(blk, tx, old_lc, lch_len);
	}
      } else {
        storage_self.queryBlockchainArray(sql_error, params, function (err, rows) {
	});
        failure_callback(blk, tx, old_lc, lc_len);
      }
    } else {
      failure_callback(blk, tx, old_lc, lc_len);
    }
  });

  return;
}
Storage.prototype.validateTransactionInputsForAddingToMempool = function validateTransactionInputsForAddingToMempool(tx, mycallback) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { mycallback(this.app, tx); return; }

  var storage_self = this;

  var sql       = "";
  var params    = {};
  var utxiarray = tx.transaction.from;
  var gtnum     = 0;

  for (var via = 0; via < utxiarray.length; via++) {

    var utxi = utxiarray[via];

    if (utxi.amt == 0 && utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && (utxi.gt == 1 || utxi.ft == 1)) { gtnum++; } else {
      if (sql == "") {
        sql = "SELECT count(*) AS count FROM slips WHERE (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND spent = 0 AND address = \""+utxi.add+"\") ";
      } else {
        sql = sql + " OR (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND spent = 0 AND address = \""+utxi.add+"\") ";
      }
    }
  }

  if (gtnum == utxiarray.length) { mycallback(this.app, tx); return; }
  this.queryBlockchain(sql, params, function (err, row) {
    if (row != null) {
      if (row.count > 0) {
        if ((row.count+gtnum) == utxiarray.length) {
          mycallback(storage_self.app, tx);
	  return; 
        }
      }
    }
  });

  return;
}

Storage.prototype.validateTransactionInputsOnBlockchainIndexAndStore = function validateTransactionInputsOnBlockchainIndexAndStore(myblk, chain_hashes, old_lc, lc_len, blocks_to_validate_sequentially, forceAdd="no") {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var storage_self = this;
  var spent_inputs = [];

  // chain hashes creates a list of BLOCK HASHES in SQL snippet
  // so that we can seach for an IN -- i.e. make sure the spend
  // is not IN one of the blocks with this hash.
  var chain_hash_sql = "";
  for (var schc = 0; schc < chain_hashes.length; schc++) {
    if (chain_hash_sql.length > 1) { chain_hash_sql += ","; }
    chain_hash_sql += '"'+chain_hashes[schc]+'" ';
  }


  // use an associative array to check against double-input spending
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
          this.app.blockchain.failedBlockTransactionValidation(myblk, tx, old_lc, lc_len);
	  return 0;
	} else {
	  tmpftfound = 1;
	}
      }

      // we can have multiple golden ticket-tagged sources in the block, but the BID/SID/TID will differ
      var as_indexer = "a"+tmpbid+"-"+tmptid+"-"+tmpsid+"-"+tmpgt;
      if (spent_inputs[as_indexer] == 1) {
	console.log("Block invalid: multiple transactions spend same input: "+tmpbid+"/"+tmptid+"/"+tmpsid+"/"+tmpgt);
        this.app.blockchain.failedBlockTransactionValidation(myblk, tx, old_lc, lc_len);
	return 0;
      }
      spent_inputs[as_indexer] = 1;
    }
  }
  spent_inputs = null;

  if (blocks_to_validate_sequentially == 1) {
    for (var mbi = 0; mbi < myblk.transactions.length; mbi++) {
      this.validateInputsWithDualCallbacks(myblk, myblk.transactions[mbi], myblk.returnId(), chain_hash_sql, old_lc, lc_len, forceAdd, this.app.blockchain.successfulBlockTransactionValidation, this.app.blockchain.failedBlockTransactionValidation);
    }
  } else {

    max_block_id = myblk.returnId();
    min_block_id = max_block_id - (blocks_to_validate_sequentially-0);  

    var sql = "SELECT * FROM blocks WHERE block_id >= $min_block_id AND block_id <= $max_block_id AND longest_chain = 1 ORDER BY block_id ASC";
    var params = {
      $min_block_id : min_block_id,
      $max_block_id : max_block_id
    } 

    storage_self.queryBlockchainArray(sql, params, function (err, rows) {
      for (var sqlr = 0; sqlr < rows.length; sqlr++) {
        var tmpblk = new saito.block(this.app, rows[sqlr].block);
        for (var sql2r = 0; sql2r < tmpblk.transactions.length; sql2r++) {
          var tmptx = tmpblk.transactions[sql2r];
          storage_self.validateInputsWithDualCallbacks(tmpblk, tmptx, tmpblk.returnId(), chain_hash_sql, old_lc, lc_len, forceAdd, storage_self.app.blockchain.successfulBlockTransactionValidation, storage_self.app.blockchain.failedBlockTransactionValidation);
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

  var sql = "UPDATE blocks SET reindexed = 0";
  this.db.run(sql, {}, function (err, row) { 

    // Re-indexing a massive database will cause memory heap problems so we
    // process entries in batches, with the size depending on the size of 
    // the callback limit in the blockchain class, which we treat as a 
    // reasonable number of blocks to handle in memory at any time
    storage_self.reindexing_timer = setInterval(function() {

      // do not repeat ourselves
      if (storage_self.reindexing_chunk == 1) { return; }

      if (storage_self.app.blockchain.mempool.blocks.length < 5) {

	storage_self.reindexing_chunk = 1;

        var sql = "SELECT count(*) AS count, min(block_id) AS min_block FROM blocks WHERE reindexed = 0 ORDER BY block_id ASC LIMIT $blimit";
        if (mylimit == 0) { sql = "SELECT count(*) AS count, min(block_id) AS min_block FROM blocks WHERE reindexed = 0 ORDER BY block_id ASC"; }
        storage_self.db.get(sql, {
          $blimit: mylimit
        }, function (err, row) {
          if (row != null) {

            var lowest_block_id     = row.min_block;
            var total_blocks_to_add = row.count;
            if (total_blocks_to_add == 0 || lowest_block_id == null) { 
	      storage_self.reindexing_blocks = 0; 
	      clearInterval(storage_self.reindexing_timer);
	    }

            if (storage_self.reindexing_blocks == 1) {
	      storage_self.reindexRecentBlocksChunk(lowest_block_id);
            }

	  } else {
	    storage_self.reindexing_blocks = 0;
	    clearInterval(storage_self.reindexing_timer);
	  }

        });

      }

    });
  });
}
Storage.prototype.reindexRecentBlocksChunk = function reindexRecentBlocksChunk(lowest_block_id) {

  var storage_self = this;

  // check the callback limit in the Blockchain Class -- we will need to keep 
  // these blocks in memory anyway, so if there are problems with their size
  // that will cause failures there.
  var cblimit = this.app.blockchain.callback_limit;

  var sql = "SELECT * FROM blocks WHERE block_id >= $lowest_block_id AND reindexed = 0 ORDER BY block_id ASC LIMIT $blimit";
  this.db.all(sql, {
    $blimit: cblimit,
    $lowest_block_id : lowest_block_id
  }, function (err, rows) {
    for (var sqlr = 0; sqlr < rows.length; sqlr++) {
      var blk = new saito.block(storage_self.app, rows[sqlr].block);
          blk.prevalidated = 1; // force-add to index
                                // cannot be set through json
      console.log("REPOPULATING INDEX w/: "+ rows[sqlr].hash + " (" + blk.block.unixtime + ")");
      storage_self.app.blockchain.mempool.addBlock(blk);

      var sql2    = "UPDATE blocks SET reindexed = 1 WHERE block_id = $block_id AND hash = $block_hash";
      var params2 = {
	$block_id   : rows[sqlr].block_id,
	$block_hash : rows[sqlr].hash
      }
      storage_self.db.run(sql2, params2, function(err) {});
    }
    storage_self.app.blockchain.mempool.processBlocks();
    storage_self.reindexing_chunk = 0;
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
  peer.sync_sending_db_bid = 0;
  peer.sync_sending        = 1;
  peer.sync_timer = setInterval(function() {
   
    if (peer.message_queue.length < 10) {
      peer.sync_sending_chunk = 0;
    }

    if (peer.sync_sending_chunk == 1) { return; }
    peer.sync_sending_chunk = 1;

    var sql    = "SELECT count(*) AS count FROM blocks WHERE block_id >= $block_id AND id > $db_id ORDER BY block_id, id ASC";
    var params = { $block_id : peer.sync_sending_bid , $db_id : peer.sync_sending_db_bid };
    storage_self.db.get(sql, params, function (err, row) {
      if (row != null) {
        var count = row.count;
        if (count > 0) {
	  if (peer.message_queue.length < 10) {
            storage_self.sendBlockchainChunk(peer);
	  }
        } else {
	  clearInterval(peer.sync_timer);
	  peer.sync_sending = 0;
	}
      } else {
	clearInterval(peer.sync_timer);
	peer.sync_sending = 0;
      }
    });
  }, peer.sync_timer_speed);

}
Storage.prototype.sendBlockchainChunk = function sendBlockchainChunk(peer) {

  // send 10 per chunk
  var sql    = "SELECT * FROM blocks WHERE block_id >= $block_id AND id >= $db_id ORDER BY block_id, id ASC LIMIT 10";
  var params = { $block_id : peer.sync_sending_bid , $db_id : peer.sync_sending_db_bid };

  this.app.storage.queryBlockchainArray(sql, params, function (err, rows) {
    if (rows == null) { 
      peer.sync_sending = 0; 
      clearInterval(peer.sync_timer);
      return; 
    }
    for (var r = 0; r < rows.length; r++) {
      row = rows[r];
      if (row.block != null) {
        peer.sendRequest("block", row.block);
        peer.block_sync = row.block_id;
        peer.sync_sending_db_bid = row.id;
        peer.sync_sending_bid    = row.block_id;
      }
    }
    if (peer.isConnected() != 1) {
      peer.sync_sending = 0; 
      clearInterval(peer.sync_timer);
      return; 
    }
  });

}





