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
//
// Our options variable holds the most important configuration information
// 
// options.archives
// options.wallet
// options.server
// options.peers
// options.aes
// options.dns
// options.keys
// options.blockchain
// options.voter
//
/////////////
// Loading //
/////////////
Storage.prototype.loadOptions = function loadOptions() {

  storage_self = this;

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
////////////
// Saving //
////////////
Storage.prototype.saveOptions = function saveOptions(reset_from_remote=0) {

  if (storage_self.app.options == null) { storage_self.app.options = {}; }

  // update options
  if (this.app.options.archives == null) {
    this.app.options.archives   = this.app.archives.returnArchives();
  }
  if (this.app.options.wallet == null) {
    this.app.options.wallet     = this.app.wallet.returnWallet();
  }
  if (this.app.options.server == null) {
    this.app.options.server     = this.app.server.returnServer();
  }
  if (this.app.options.peers == null) {
    this.app.options.peers      = this.app.network.returnPeers();
  }
  //if (this.app.options.dns == null) {
    this.app.options.dns        = this.app.dns.returnDNS();
  //}
  if (this.app.options.keys == null) {
    this.app.options.keys       = this.app.keys.returnKeys();
  }
  if (this.app.options.aes == null) {
    this.app.options.aes       = this.app.aes.returnAes();
  }
  if (this.app.options.blockchain == null) {
    this.app.options.blockchain = this.app.blockchain.returnBlockchain();
  } else {
    if (this.app.blockchain.returnLatestBlockId() > this.app.options.blockchain.lastblock) {
      this.app.options.blockchain.lastblock = this.app.blockchain.returnLatestBlockId();
    }
  }
  if (this.app.options.voter == null) {
    this.app.options.voter      = this.app.blockchain.voter.returnVoter();
  }


  if (reset_from_remote == 1) {

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

    storage_self = this;

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
////////////
// Client //
////////////
//
// this is the information fed-out to clients that connect to the 
// network using their browser, but who do not have a copy of their
// configuration file, and thus need a new one. We produce one that
// lets them connect to us, and specifies us as their DNS provider.
//
Storage.prototype.saveClientOptions = function saveClientOptions() {

  if (this.app.BROWSER == 1) { return; }

  // produce a version of our options file for distribution to web clients
  // contain information on our available mods as well as help
  // on how to connect to our server.
  var tmpjson                      = {};
  tmpjson.archives             = [];
  tmpjson.keys                 = [];
  tmpjson.peers                = [];
  tmpjson.dns                  = [];
  tmpjson.blockchain           = {};
  tmpjson.blockchain.lastblock = this.app.blockchain.returnLatestBlockId();

  // include our server as a peer
  tmpjson.peers.push(this.app.server.returnServer());


  // add information depending on the modules we run
  for (var dsl = 0; dsl < this.app.modules.mods.length; dsl++) {

    // domain servers
    if (this.app.modules.mods[dsl].handlesDNS == 1) {
      var tmpdnsserver = {};
      tmpdnsserver.domain     = this.app.modules.mods[dsl].domain;
      tmpdnsserver.host       = this.app.modules.mods[dsl].host;
      tmpdnsserver.port       = this.app.modules.mods[dsl].port;
      tmpdnsserver.publickey  = this.app.modules.mods[dsl].publickey;
      tmpjson.dns.push(tmpdnsserver);
    }

    // archival services
    if (this.app.modules.mods[dsl].name == "Archive") {
      var tmparchivalserver = {};
      tmparchivalserver.host = this.app.modules.mods[dsl].host;
      tmparchivalserver.port = this.app.modules.mods[dsl].port;
      tmparchivalserver.publickey = this.app.modules.mods[dsl].publickey;
      tmparchivalserver.active = "inactive";
      tmpjson.archives.push(tmparchivalserver);
    }
  }

  fs.writeFileSync("saito/web/client.options", JSON.stringify(tmpjson), function(err) {
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

  this.db.exec("\
        CREATE TABLE IF NOT EXISTS blocks (\
                id INTEGER, \
                block_id INTEGER, \
                block TEXT, \
                hash TEXT, \
                conf INTEGER, \
                longest_chain INTEGER, \
                UNIQUE (block), \
                PRIMARY KEY(id ASC) \
        )");
  this.db.exec("\
        CREATE TABLE IF NOT EXISTS txs (\
                id INTEGER, \
                block_id INTEGER, \
                tx_id INTEGER, \
                tx TEXT, \
                block_hash TEXT, \
                longest_chain INTEGER, \
                UNIQUE (tx), \
                PRIMARY KEY(id ASC) \
        )");
  this.db.exec("\
        CREATE TABLE IF NOT EXISTS slips (\
                id INTEGER, \
                block_id INTEGER, \
                tx_id INTEGER, \
                slip_id INTEGER, \
                block_hash TEXT, \
                longest_chain INTEGER, \
                golden_ticket INTEGER, \
                slip_json TEXT, \
                address TEXT, \
                amount NUMERIC, \
                spent INTEGER, \
                UNIQUE (slip_json, block_hash, block_id, tx_id, slip_id), \
                PRIMARY KEY(id ASC) \
        )");

}



//////////////////////
// Save to Database //
//////////////////////
Storage.prototype.saveLongestChainStatus = function saveLongestChainStatus(block_hash, block_id, longest_chain_status) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  storage_self = this;

  // blocks
  var sql = "UPDATE blocks SET longest_chain = $longest_chain_status WHERE block_id = $block_id AND hash = $block_hash";
  this.db.run(sql, {
    $block_id: block_id,
    $block_hash: block_hash,
    $longest_chain_status: longest_chain_status
  }, function(err) {
  });

  // transactions
  var sql = "UPDATE txs SET longest_chain = $longest_chain_status WHERE block_id = $block_id AND block_hash = $block_hash";
  this.db.run(sql, {
    $block_id: block_id,
    $block_hash: block_hash,
    $longest_chain_status: longest_chain_status
  }, function(err) {
  });


  // transactions
  var sql = "SELECT * FROM txs WHERE block_id = $block_id AND block_hash = $block_hash";
  var params = {
    $block_id: block_id,
    $block_hash: block_hash,
  };
  var tmp_lcs = longest_chain_status;
  this.queryBlockchainArray(sql, params, function(err, rows) {

    for (var sqlr = 0; sqlr < rows.length; sqlr++) {
      var tmptx = new saito.transaction(rows[sqlr].tx);
      for (var tti = 0; tti < tmptx.transaction.from.length; tti++) {

	var bid = tmptx.transaction.from[tti].bid;
	var tid = tmptx.transaction.from[tti].tid;
	var sid = tmptx.transaction.from[tti].sid;

	if (tmp_lcs == 0) {
	
	  var sql = "UPDATE slips SET longest_chain = $longest_chain_status, spent = 0 WHERE block_id = $block_id AND block_hash = $block_hash AND tx_id = $tx_id AND slip_id = $slip_id";
      		var params =  {
	    $block_id: bid,
	    $block_hash: block_hash,
	    $tx_id: tid,
	    $slip_id: sid,
	    $longest_chain_status: tmp_lcs
	  };
          storage_self.db.run(sql, params, function(err) {
	  });
        }

        if (tmp_lcs == 1) {	
          var sql = "UPDATE slips SET longest_chain = $longest_chain_status, spent = $spent_block_id WHERE block_id = $block_id AND block_hash = $block_hash AND tx_id = $itx_id AND slip_id = $slip_id";
          var params =  {
	    $block_id: bid,
	    $block_hash: block_hash,
	    $tx_id: tid,
	    $slip_id: sid,
            $spent_block_id: bid,
	    $longest_chain_status: tmp_lcs
          }
      	  storage_self.db.run(sql, params, function(err) {
          });
        }
      }
    }
  });
}





Storage.prototype.saveBlock = function saveBlock(blk, lc=0) {

  if (this.app.BROWSER == 1) { return; }

  var sql = "INSERT OR IGNORE INTO blocks (block_id, block, hash, conf, longest_chain) VALUES ($block_id, $block, $hash, 0, $lc)";
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
  this.db.run(var sql, {
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
    this.spendSlip(tx.transaction.from[bba].bid, tx.transaction.from[bba].tid, tx.transaction.from[bba].sid, tx.transaction.from[bba].add, block_hash);
  }

}
Storage.prototype.saveSlip = function saveSlip(block_id, tx_id, slip_id, slip_json, slip, bhash, lc) {

  if (this.app.BROWSER == 1) { return; }

  var sql = "INSERT OR IGNORE INTO slips (block_id, tx_id, slip_id, slip_json, golden_ticket, address, amount, block_hash, longest_chain, spent) VALUES ($block_id, $tx_id, $slip_id, $slip_json, $golden_ticket, $address, $amount, $bhash, $lc, $spent)";
  var params = {
    $block_id: block_id,
    $tx_id: tx_id,
    $slip_id: slip_id,
    $slip_json: slip_json,
    $golden_ticket: slip.gt,
    $address: slip.add,
    $amount: slip.amt,
    $bhash: bhash,
    $lc: lc,
    $spent: 0
  };

  this.db.run(sql, params, function(err) {
  });

}
Storage.prototype.spendSlip = function spendSlip(block_id, tx_id, slip_id, address, block_hash) {

  if (this.app.BROWSER == 1) { return; }

  var sql = "UPDATE slips SET spent = $spent_block_id WHERE block_id = $block_id AND tx_id = $tx_id AND slip_id = $slip_id AND address = $address";
  var params = {
    $spent_block_id : block_id,
    $block_hash : block_hash,
    $block_id   : block_id,
    $tx_id      : tx_id,
    $slip_id    : slip_id,
    $address    : address
  }
  this.db.run(sql, params, function(err) {
  });

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
Storage.prototype.validateInputsWithCallbackOnSuccess = function validateInputsWithCallbackOnSuccess(tx, mycallback) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { mycallback(this.app, tx); }

  storage_self = this;

  var sql    = "";
  var params = {};
  var utxiarray = tx.transaction.from;
  var gtnum = 0;

  for (var via = 0; via < utxiarray.length; via++) {

    var utxi  = utxiarray[via];

    if (utxi.amt == 0 && utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && utxi.gt == 1) { gtnum++; } else {
      if (sql == "") {
        sql    = "SELECT count(*) AS count FROM slips WHERE (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND spent = 0 AND address = $address) ";
        params = { $address : utxi.add };
      } else {
        sql    = sql + " OR (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND spent = 0 AND address = $address) ";
        params = { $address : utxi.add };
      }
    }
  }

  // if we have only golden ticket inputs
  if (gtnum == utxiarray.length) { mycallback(this.app, tx); return; }
  this.queryBlockchain(sql, params, function (err, row) {
    if (row != null) {
      if (row.count > 0) {
        if ((row.count+gtnum) == utxiarray.length) {
          mycallback(storage_self.app, tx);
        }
      } else {
      }
    }
  });

  return;
}
Storage.prototype.validateInputsWithCallbackOnFailure = function validateInputsWithCallbackOnFailure(blk, tx, spent_block_id, unacceptable_block_hashes_sql_list, old_lc, lchain_len, mycallback) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  storage_self = this;

  var utxiarray = tx.transaction.from;
  var gtnum  = 0;
  var sql    = "";
  var params = {};

  for (var via = 0; via < utxiarray.length; via++) {

    var utxi  = utxiarray[via];

    if (utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && utxi.gt == 1 && utxi.amt == 0) {
	gtnum++;
    }

    if (sql == "") {
      sql    = "SELECT count(*) AS count FROM slips WHERE (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND (       (    (spent = 0 OR spent <= "+parseInt(spent_block_id)+") OR (spent > "+parseInt(spent_block_id)+" AND block_hash NOT IN ("+unacceptable_block_hashes_sql_list+")      )     )     ) AND address = $address) ";
      params = { $address : utxi.add };
    } else {
      sql    = sql + " OR (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND  (     (    (spent = 0 OR spent <= "+parseInt(spent_block_id)+") OR (spent > "+parseInt(spent_block_id)+" AND block_hash NOT IN ("+unacceptable_block_hashes_sql_list+")     )      )     )   AND address = $address) ";
      params = { $address : utxi.add };
    }
  }

  // if the golden ticket is the only tx
  if (gtnum == utxiarray.length) { return; }
  this.queryBlockchain(sql, params, function (err, row) {
    if (row != null) {
      if (row.count > 0) {
        if ((row.count+gtnum) == utxiarray.length) {
	} else {
          mycallback(blk, tx, old_lc, lchain_len);
	}
      } else {
        mycallback(blk, tx, old_lc, lchain_len);
      }
    } else {
      // total failure, no record found
      mycallback(blk, tx, old_lc, lchain_len);
    }
  });

  return;
}
Storage.prototype.validateTransactionInputs = function validateTransactionInputs(myblk, chain_hashes, old_lc, lchain_len) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  storage_self = this;

  // chain hashes creates a list of BLOCK HASHES in SQL snippet
  // so that we can seach for an IN -- i.e. make sure the spend
  // is not IN one of the blocks with this hash.
  var chain_hash_sql = "";
  for (var schc = 0; schc < chain_hashes.length; schc++) {
    if (chain_hash_sql.length > 1) { chain_hash_sql += ","; }
    chain_hash_sql += '"'+chain_hashes[schc]+'" ';
  }

  for (var mbi = 0; mbi < myblk.transactions.length; mbi++) {

    this.validateInputsWithCallbackOnFailure(myblk, myblk.transactions[mbi], myblk.returnId(), chain_hash_sql, old_lc, lchain_len, function(blk, tx, old_lc) {

      console.log("\n\nBAD TRANSACTION results in BLOCK PURGE\n\n");
      console.log(tx);
      console.log(blk);
      console.log("resetting longest chain to: "+old_lc);

      // restore Longest Chain to previous
      storage_self.app.blockchain.longestChain = old_lc;

      // reset lc in index
      //
      // lchain_len is already +1 to capture shared_ancestor
      // so no need to +1 it here
      var formerchain = storage_self.app.blockchain.returnLongestChainIndex(lchain_len);
      storage_self.app.blockchain.rewriteLongestChainIndex(lchain_len, formerchain)
      storage_self.app.blockchain.resetMiner();


      // remove block and tx
      if (blk == null) {
        storage_self.app.blockchain.mempool.removeTransaction(tx);
      } else {
        storage_self.app.blockchain.mempool.removeTransaction(tx);
        storage_self.app.blockchain.deIndexAndPurge(blk);
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

  storage_self = this;

  var sql = "SELECT * FROM blocks ORDER BY block_id ASC LIMIT $blimit";
  if (mylimit == 0) { sql = "SELECT * FROM blocks ORDER BY block_id ASC"; }
  this.db.all(sql, {
    $blimit: mylimit
  }, function (err, rows) {
    for (var sqlr = 0; sqlr < rows.length; sqlr++) {
      var blk = new saito.block(storage_self.app, rows[sqlr].block);
      console.log("REPOPULATING INDEX w/: "+ rows[sqlr].hash + " (" + blk.block.unixtime + ")");
      // the "force" argument ensures the block is added even if it comes before
      // the block that we think is our earliest block. This is used when initializing
      // our index
      storage_self.app.blockchain.indexAndStore(new saito.block(storage_self.app, rows[sqlr].block), "force");
    }
  });
}


