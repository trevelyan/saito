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





////////////
// Saving //
////////////
Storage.prototype.saveOptions = function saveOptions(reset_from_remote=0) {

  var storage_self = this;

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
  if (this.app.options.dns == null) {
    this.app.options.dns        = this.app.dns.returnDNS();
  }
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
      this.app.options.blockchain.fork_id   = this.app.blockchain.returnForkId();
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
  var tmpjson                  = {};
  tmpjson.archives             = [];
  if (this.app.options.archives != null) {
    tmpjson.archives             = this.app.options.archives;
  }
  tmpjson.keys                 = [];
  tmpjson.peers                = [];
  tmpjson.dns                  = [];
  if (this.app.options.dns != null) {
    tmpjson.dns                = this.app.options.dns;
  }
  tmpjson.blockchain           = {};
  tmpjson.blockchain.lastblock = this.app.blockchain.returnLatestBlockId();

  // include our server as a peer
  tmpjson.peers.push(this.app.server.returnServer());

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
                fee_ticket INTEGER, \
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
//
//
// this reset SPEND to 0 if not part of longest chain
//
Storage.prototype.saveLongestChainStatus = function saveLongestChainStatus(block_hash, block_id, longest_chain_status) {

  console.log("ENTERED saveLongestChainStatus for "+block_hash+" ("+block_id+") "+longest_chain_status);

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var storage_self = this;

  // blocks
  var sql = "UPDATE blocks SET longest_chain = $longest_chain_status WHERE block_id = $block_id AND hash = $block_hash";
  //console.log("UPDATE blocks SET longest_chain = "+longest_chain_status+" WHERE block_id = "+block_id+" AND hash = "+block_hash);

  this.db.run(sql, {
    $block_id: block_id,
    $block_hash: block_hash,
    $longest_chain_status: longest_chain_status
  }, function(err) {
  });

  // transactions
  var sql2 = "UPDATE txs SET longest_chain = $longest_chain_status WHERE block_id = $block_id AND block_hash = $block_hash";
  //console.log("UPDATE txs SET longest_chain = "+longest_chain_status+" WHERE block_id = "+block_id+" AND block_hash = "+block_hash);
  this.db.run(sql2, {
    $block_id: block_id,
    $block_hash: block_hash,
    $longest_chain_status: longest_chain_status
  }, function(err) {
  });

  // slips in block, reset to 0
  var sql3 = "UPDATE slips SET longest_chain = $longest_chain_status WHERE block_id = $block_id AND (block_hash = $block_hash OR golden_ticket = 1 OR fee_ticket = 1)";
  if (longest_chain_status == 0) {
    sql3 = "UPDATE slips SET longest_chain = $longest_chain_status, spent = 0 WHERE block_id = $block_id AND (block_hash = $block_hash OR golden_ticket = 1 OR fee_ticket = 1)";
    console.log("UPDATE slips SET longest_chain = "+longest_chain_status+", spent = 0 WHERE block_id = "+block_id+" AND (block_hash = "+block_hash+" OR golden_ticket = 1 OR fee_ticket = 1");
  } else {
    console.log("UPDATE slips SET longest_chain = "+longest_chain_status+" WHERE block_id = "+block_id+" AND (block_hash = "+block_hash+" OR golden_ticket = 1 OR fee_ticket = 1");
  }
  this.db.run(sql3, {
    $block_id: block_id,
    $block_hash: block_hash,
    $longest_chain_status: longest_chain_status
  }, function(err) {
  });


  // slips from other blocks, in this block's transactions
  var sql4 = "SELECT * FROM txs WHERE block_id = $block_id AND block_hash = $block_hash";
  console.log("-- transactions from block to reset ---> SELECT * FROM txs WHERE block_id = "+block_id+" AND block_hash = '"+block_hash+"'");
  var params4 = {
    $block_id: block_id,
    $block_hash: block_hash,
  };
  var tmp_lcs = longest_chain_status;
  this.queryBlockchainArray(sql4, params4, function(err, rows) {

    for (var sqlr = 0; sqlr < rows.length; sqlr++) {

      var tmptx = new saito.transaction(rows[sqlr].tx);

      for (var tti = 0; tti < tmptx.transaction.from.length; tti++) {

        var bhash = tmptx.transaction.from[tti].bhash;
        var bid   = tmptx.transaction.from[tti].bid;
        var tid   = tmptx.transaction.from[tti].tid;
        var sid   = tmptx.transaction.from[tti].sid;

//	var bid   = rows[sqlr].block_id;
//	var tid   = rows[sqlr].tx_id;
//	var sid   = tti;

	if (tmp_lcs == 0) {
	
          // golden ticket slips do not have their block_hash set
	  //var sql5 = "UPDATE slips SET spent = 0 WHERE (block_hash = $block_hash OR golden_ticket = 1 OR fee_ticket = 1) AND block_id = $block_id AND tx_id = $tx_id AND slip_id = $slip_id";
	  var sql5 = "UPDATE slips SET spent = 0 WHERE block_id = $block_id AND tx_id = $tx_id AND slip_id = $slip_id";
          console.log("UPDATE slips SET spent = 0 WHERE (block_hash = \""+bhash+"\" OR golden_ticket = 1 OR fee_ticket = 1) AND block_id = "+bid+" AND tx_id = "+tid+" AND slip_id = "+sid);
      	  var params5 =  {
	    $block_hash: bhash,
	    $block_id: bid,
	    $tx_id: tid,
	    $slip_id: sid
	  };
          storage_self.db.run(sql5, params5, function(err) { });
        }

        if (tmp_lcs == 1) {

	  //var sql6 = "UPDATE slips SET spent = $block_spent WHERE block_hash = $block_hash AND block_id = $block_id AND tx_id = $tx_id AND slip_id = $slip_id";
	  var sql6 = "UPDATE slips SET spent = $block_spent WHERE block_hash = $block_hash AND block_id = $block_id AND tx_id = $tx_id AND slip_id = $slip_id";
          console.log("UPDATE slips SET spent = "+block_id+" WHERE block_hash = "+block_hash+" AND block_id = "+bid+" AND tx_id = "+tid+" AND slip_id = "+sid);
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





Storage.prototype.saveBlock = function saveBlock(blk, lc=0) {

  if (this.app.BROWSER == 1) { return; }

  var sql = "INSERT OR IGNORE INTO blocks (block_id, block, hash, conf, longest_chain) VALUES ($block_id, $block, $hash, 0, $lc)";
  //console.log("INSERT OR IGNORE INTO blocks (block_id, block, hash, conf, longest_chain) VALUES ($block_id, $block, $hash, 0, $lc)");
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
  //console.log("INSERT OR IGNORE INTO txs (block_id, block_hash, tx_id, tx, longest_chain) VALUES ($block_id, $block_hash, $tx_id, $tx, $lc)");
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

  this.execDatabase(sql, params, function(err) {
  });

}
Storage.prototype.spendSlip = function spendSlip(spending_block_id, block_id, tx_id, slip_id, address, block_hash) {

  if (this.app.BROWSER == 1) { return; }

  var sql = "UPDATE slips SET spent = $spent_block_id WHERE block_hash = $block_hash AND block_id = $block_id AND tx_id = $tx_id AND slip_id = $slip_id AND address = $address";
  //console.log("***** UPDATE slips SET spent = "+spending_block_id+" WHERE block_id = "+block_id+" AND tx_id = "+tx_id+" AND slip_id = "+slip_id+" AND address = \""+address+"\"");
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
Storage.prototype.validateInputsWithDualCallbacks = function validateInputsWithDualCallbacks(blk, tx, spent_block_id, unacceptable_block_hashes_sql_list, old_lc, lchain_len, success_callback, failure_callback) {

  var storage_self = this;

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { success_callback(storage_self.app, tx); return; }

console.log("CHECKING INPUTS FOR BLOCK: "+blk.block.id);

  var this_blk = blk;
  var this_tx  = tx;
  var this_spent_block_id = spent_block_id;
  var this_unacceptable_block_hashes_sql_list = unacceptable_block_hashes_sql_list;
  var this_old_lc = old_lc;
  var this_lchain_len = lchain_len;

  var sql    = "";
  var sql_error = "";
  var params = {};
  var utxiarray = tx.transaction.from;
  var gtnum = 0;

// should we be referencing the SID here or should we we use VIA since we are iterating through the from
// and may not be able to trust the SID in teh transactions themselves, especially if we produced that
// transaction? No -- it makes sense that the slip will have the SID data

  for (var via = 0; via < utxiarray.length; via++) {

    var utxi  = utxiarray[via];

console.log("OUTPUT OF UTXI used to PRODUCE BLOCKCHECK:");
console.log(JSON.stringify(utxi,null,4));

    if (utxi.amt == 0 && utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && (utxi.gt == 1 || utxi.ft == 1)) { gtnum++; } else {
      if (sql == "") {
        sql       = "SELECT count(*) AS count FROM slips WHERE (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND (spent = 0 OR spent = "+parseInt(this_blk.returnId())+") AND address = \""+utxi.add+"\") ";
        sql_error = "SELECT * FROM slips WHERE (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND (spent = 0 OR spent = "+parseInt(this_blk.returnId())+") AND address = \""+utxi.add+"\") ";
      } else {
        sql    = sql + " OR (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND (spent = 0 OR spent = "+parseInt(this_blk.returnId())+") AND address = \""+utxi.add+"\") ";
        sql_error = sql_error + " OR (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND (spent = 0 OR spent = "+parseInt(this_blk.returnId())+") AND address = \""+utxi.add+"\") ";
      }
    }
  }


  // if we have only golden ticket inputs
  if (gtnum == utxiarray.length) { success_callback(storage_self.app, tx); return; }
  this.queryBlockchain(sql, params, function (err, row) {
    if (row != null) {
      if (row.count > 0) {
        if ((row.count+gtnum) == utxiarray.length) {
          success_callback(storage_self.app, tx);
        } else {
console.log("failure 1:");
console.log(sql);
console.log(params);
console.log(sql_error);
          storage_self.queryBlockchainArray(sql_error, params, function (err, rows) {
console.log("THE DATABASE CONTAINS:");
console.log(rows);
	  });
          failure_callback(this_blk, this_tx, this_old_lc, this_lchain_len);
	}
      } else {
console.log("failure 2:");
console.log(sql);
console.log(params);
console.log(sql_error);
        storage_self.queryBlockchainArray(sql_error, params, function (err, rows) {
console.log("THE DATABASE CONTAINS:");
console.log(rows);
	});
console.log("FAILED CALLBACK: blk");
console.log(blk.block.id);
console.log(this_blk.block.id);
console.log("FAILED TX IN BLK: ");
console.log(old_lc);
console.log(this_old_lc);
console.log(lchain_len);
console.log(this_lchain_len);
console.log("\nDONE");
        failure_callback(this_blk, this_tx, this_old_lc, this_lchain_len);
      }
    } else {
console.log("failure 3:");
console.log(sql);
console.log(params);
      failure_callback(blk, tx, old_lc, lchain_len);
    }
  });

  return;
}
Storage.prototype.validateInputsWithCallbackOnSuccess = function validateInputsWithCallbackOnSuccess(tx, mycallback) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { mycallback(this.app, tx); return; }

  var storage_self = this;

  var sql    = "";
  var params = {};
  var utxiarray = tx.transaction.from;
  var gtnum = 0;

  for (var via = 0; via < utxiarray.length; via++) {

    var utxi  = utxiarray[via];

    if (utxi.amt == 0 && utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && (utxi.gt == 1 || utxi.ft == 1)) { gtnum++; } else {
      if (sql == "") {
        sql    = "SELECT count(*) AS count FROM slips WHERE (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND spent = 0 AND address = \""+utxi.add+"\") ";
      } else {
        sql    = sql + " OR (longest_chain = 1 AND block_id = "+parseInt(utxi.bid)+" AND tx_id = "+parseInt(utxi.tid)+" AND slip_id = "+parseInt(utxi.sid)+" AND spent = 0 AND address = \""+utxi.add+"\") ";
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
	  return; 
        } else {
console.log("failure validation 1: " +row.count+ " -- " + gtnum + " -- " + utxiarray.length );
console.log(sql);
        }
      } else {
console.log("failure validation 2");
console.log(sql);
      }
    } else {
console.log("failure validation 3");
console.log(sql);
    }
  });

  return;
}
Storage.prototype.validateInputsWithCallbackOnFailure = function validateInputsWithCallbackOnFailure(blk, tx, spent_block_id, unacceptable_block_hashes_sql_list, old_lc, lchain_len, mycallback) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  var storage_self = this;

  var utxiarray = tx.transaction.from;
  var gtnum  = 0;
  var sql    = "";
  var params = {};

  for (var via = 0; via < utxiarray.length; via++) {

    var utxi  = utxiarray[via];

    if (utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && (utxi.gt == 1 || utxi.ft == 1) && utxi.amt == 0) {
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



Storage.prototype.validateTransactionInputs = function validateTransactionInputs(myblk, chain_hashes, old_lc, lchain_len, blocks_to_validate_sequentially) {

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
          this.app.blockchain.failedBlockTransactionValidation(myblk, tx, old_lc, lchain_len);
	  return 0;
	} else {
	  tmpftfound = 1;
	}
      }

      // we can have multiple golden ticket-tagged sources in the block, but the BID/SID/TID will differ
      var as_indexer = "a"+tmpbid+"-"+tmptid+"-"+tmpsid+"-"+tmpgt;
      if (spent_inputs[as_indexer] == 1) {
	console.log("Block invalid: multiple transactions spend same input: "+tmpbid+"/"+tmptid+"/"+tmpsid+"/"+tmpgt);
        this.app.blockchain.failedBlockTransactionValidation(myblk, tx, old_lc, lchain_len);
	return 0;
      }
      spent_inputs[as_indexer] = 1;
    }
  }
  spent_inputs = null;


  //console.log("VALIDATING ALL TRANSACTIONS IN BLOCK: "+myblk.returnId() + " ("+myblk.transactions.length+") -- " + blocks_to_validate_sequentially);

  if (blocks_to_validate_sequentially == 1) {
    for (var mbi = 0; mbi < myblk.transactions.length; mbi++) {
      this.validateInputsWithDualCallbacks(myblk, myblk.transactions[mbi], myblk.returnId(), chain_hash_sql, old_lc, lchain_len, this.app.blockchain.successfulBlockTransactionValidation, this.app.blockchain.failedBlockTransactionValidation);
    }
  } else {

    // we need to build the transactions for ALL previous blocks and validate them ONE by ONE
    // 
    // the database shouldalready have marked them as the longestChain at this point 
    // although there is always the possibility that it has not (TODO -- fix this)
 
    max_block_id = myblk.returnId();
    min_block_id = max_block_id - (blocks_to_validate_sequentially-0);  


    var sql = "SELECT * FROM blocks WHERE block_id >= $min_block_id AND block_id <= $max_block_id AND longest_chain = 1 ORDER BY block_id ASC";
    var params = {
      $min_block_id : min_block_id,
      $max_block_id : max_block_id
    } 


// HACK -- perhaps when we feed in teh blocks to validate, we have issues?
    storage_self.queryBlockchainArray(sql, params, function (err, rows) {
      for (var sqlr = 0; sqlr < rows.length; sqlr++) {
        var tmpblk = new saito.block(this.app, rows[sqlr].block);
        for (var sql2r = 0; sql2r < tmpblk.transactions.length; sql2r++) {
          var tmptx = tmpblk.transactions[sql2r];
          //storage_self.validateInputsWithDualCallbacks(myblk, tmptx, myblk.returnId(), chain_hash_sql, old_lc, lchain_len, storage_self.app.blockchain.successfulBlockTransactionValidation, storage_self.app.blockchain.failedBlockTransactionValidation);
          storage_self.validateInputsWithDualCallbacks(tmpblk, tmptx, tmpblk.returnId(), chain_hash_sql, old_lc, lchain_len, storage_self.app.blockchain.successfulBlockTransactionValidation, storage_self.app.blockchain.failedBlockTransactionValidation);
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

  var sql = "SELECT * FROM blocks ORDER BY block_id ASC LIMIT $blimit";
  if (mylimit == 0) { sql = "SELECT * FROM blocks ORDER BY block_id ASC"; }
  this.db.all(sql, {
    $blimit: mylimit
  }, function (err, rows) {
    for (var sqlr = 0; sqlr < rows.length; sqlr++) {
      var blk = new saito.block(storage_self.app, rows[sqlr].block);
          blk.prevalidated = 1;
      console.log("REPOPULATING INDEX w/: "+ rows[sqlr].hash + " (" + blk.block.unixtime + ")");
      // the "force" argument ensures the block is added even if it comes before
      // the block that we think is our earliest block. This is used when initializing
      // our index
      storage_self.app.blockchain.mempool.addBlock(blk);
    }
    storage_self.app.blockchain.mempool.processBlocks();
  });

}




