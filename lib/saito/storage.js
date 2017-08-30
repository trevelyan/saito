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
      console.log(this.app.options);
    } catch (err) {
      this.saveOptions();
    }

  } else {

    data = null;

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
  if (this.app.options.dns == null) {
    this.app.options.dns        = this.app.dns.returnDNS();
  }
  if (this.app.options.keys == null) {
    this.app.options.keys       = this.app.keys.returnKeys();
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

    $.ajax({
      url: '/client.options',
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
  tmpjson                      = {};
  tmpjson.archives             = [];
  tmpjson.keys                 = [];
  tmpjson.peers                = [];
  tmpjson.dns                  = [];
  tmpjson.blockchain           = {};
  tmpjson.blockchain.lastblock = this.app.blockchain.returnLatestBlockId();

  // include our server as a peer
  tmpjson.peers.push(this.app.server.returnServer());


  // add information depending on the modules we run
  for (dsl = 0; dsl < this.app.modules.mods.length; dsl++) {

    // domain servers
    if (this.app.modules.mods[dsl].handlesDNS == 1) {
      tmpdnsserver = {};
      tmpdnsserver.domain     = this.app.modules.mods[dsl].domain;
      tmpdnsserver.host       = this.app.modules.mods[dsl].host;
      tmpdnsserver.port       = this.app.modules.mods[dsl].port;
      tmpdnsserver.publickey  = this.app.modules.mods[dsl].publickey;
      tmpjson.dns.push(tmpdnsserver);
    }

    // archival services
    if (this.app.modules.mods[dsl].name == "Archive") {
      tmparchivalserver = {};
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
                UNIQUE (block), \
                PRIMARY KEY(id ASC) \
        )");
  this.db.exec("\
        CREATE TABLE IF NOT EXISTS txs (\
                id INTEGER, \
                block_id INTEGER, \
                tx_id INTEGER, \
                tx TEXT, \
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
                UNIQUE (slip_json), \
                PRIMARY KEY(id ASC) \
        )");

}



//////////////////////
// Save to Database //
//////////////////////
Storage.prototype.saveBlock = function saveBlock(blk) {

  if (this.app.BROWSER == 1) { return; }

  sql = "INSERT OR IGNORE INTO blocks (block_id, block, hash, conf) VALUES ($block_id, $block, $hash, 0)";
  this.db.run(sql, {
    $block_id: blk.block.id,
    $block: JSON.stringify(blk.block),
    $hash: blk.hash('hex')
  });

  for (b = 0; b < blk.transactions.length; b++) {
    this.saveTransaction(blk.block.id, blk.transactions[b], blk.hash());
  }

}
Storage.prototype.saveTransaction = function saveTransaction(block_id, tx, block_hash) {

console.log("BHASH: "+block_hash);

  if (this.app.BROWSER == 1) { return; }

  sql = "INSERT OR IGNORE INTO txs (block_id, tx_id, tx) VALUES ($block_id, $tx_id, $tx)";
  this.db.run(sql, {
    $block_id: block_id,
    $tx_id: tx.transaction.id,
    $tx: JSON.stringify(tx.transaction)
  });

  for (bb = 0; bb < tx.transaction.to.length; bb++) {
    this.saveSlip(block_id, tx.transaction.id, bb, JSON.stringify(tx.transaction.to[bb]), tx.transaction.to[bb], block_hash);
  }

}
Storage.prototype.saveSlip = function saveSlip(block_id, tx_id, slip_id, slip_json, slip, bhash, lc) {

console.log("save SLIP: "+bhash);

  if (this.app.BROWSER == 1) { return; }

  sql = "INSERT OR IGNORE INTO slips (block_id, tx_id, slip_id, slip_json, golden_ticket, address, amount, block_hash, longest_chain, spent) VALUES ($block_id, $tx_id, $slip_id, $slip_json, $golden_ticket, $address, $amount, $bhash, $lc, $spent)";
  params = {
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

console.log("INSERTING INTO SLIPS: "+ block_id + " / " + tx_id + " / " + slip_id);
console.log(sql);
console.log(params);
  this.db.run(sql, params, function() {});

}
Storage.prototype.saveConfirmation = function saveConfirmation(hash, conf) {

  if (this.app.BROWSER == 1) { return; }

  sql = "UPDATE blocks SET conf = $conf WHERE hash = $hash";
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

  sql1 = "DELETE FROM blocks WHERE block_id < $block_id";
  this.db.run(sql1, {
    $block_id: block_id
  });

  sql2 = "DELETE FROM txs WHERE block_id < $block_id";
  this.db.run(sql2, {
    $block_id: block_id
  });

  sql3 = "DELETE FROM slips WHERE block_id < $block_id";
  this.db.run(sql3, {
    $block_id: block_id
  });

}






//////////////////////////////////
// Read and Write from Database //
//////////////////////////////////
Storage.prototype.execDatabase = function execDatabase(sql, params, callback) {
  if (this.app.BROWSER == 1) { return; }
  this.db.run(sql, params, function () { callback(); });
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
Storage.prototype.validateInputWithCallbackOnFailure = function validateInputWithCallbackOnFailure(tx, utxi, mycallback) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  // GT transactions are validated separately
  if (utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && utxi.gt == 1) { return; } 

  storage_self = this;

  sql = "SELECT count(*) AS count FROM slips WHERE block_id = $block_id AND tx_id = $tx_id AND slip_id = $slip_id AND address = $address";
  params = { $block_id : utxi.bid , $tx_id : utxi.tid , $slip_id : utxi.sid , $address : utxi.add };
  this.queryBlockchain(sql, params, function (err, row) {
    if (row != null) {
      if (row.count > 0) {} else {
        mycallback(storage_self.app, tx, utxi);
      }
    } else {
        mycallback(storage_self.app, tx, utxi);
    }
  });


}
Storage.prototype.validateInputWithCallbackOnSuccess = function validateInputWithCallbackOnSuccess(tx, utxi, mycallback) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { mycallback(this.app, tx); }

  // GT transactions are validated separately
  if (utxi.bid == 0 && utxi.tid == 0 && utxi.sid == 0 && utxi.gt == 1) { mycallback(this.app, tx); } 

  storage_self = this;

  sql = "SELECT count(*) AS count FROM slips WHERE block_id = $block_id AND tx_id = $tx_id AND slip_id = $slip_id AND address = $address";
  params = { $block_id : utxi.bid , $tx_id : utxi.tid , $slip_id : utxi.sid , $address : utxi.add };
  this.queryBlockchain(sql, params, function (err, row) {
    if (row != null) {
      if (row.count > 0) {
        mycallback(storage_self.app, tx);
      } else {
      }
    }
  });

  return;
}






////////////////////////
// Read from Database //
////////////////////////
Storage.prototype.indexRecentBlocks = function indexRecentBlocks(mylimit=0) {

  if (this.app.BROWSER == 1 || this.app.SPVMODE == 1) { return; }

  storage_self = this;

  sql = "SELECT * FROM blocks ORDER BY block_id ASC LIMIT $blimit";
  if (mylimit == 0) { sql = "SELECT * FROM blocks ORDER BY block_id ASC"; }
  this.db.all(sql, {
    $blimit: mylimit
  }, function (err, rows) {
    for (sqlr = 0; sqlr < rows.length; sqlr++) {
      var blk = new saito.block(storage_self.app, rows[sqlr].block);
      console.log("REPOPULATING INDEX w/: "+ rows[sqlr].hash + " (" + blk.block.unixtime + ")");
      // the "force" argument ensures the block is added even if it comes before
      // the block that we think is our earliest block. This is used when initializing
      // our index
      storage_self.app.blockchain.indexAndStore(new saito.block(storage_self.app, rows[sqlr].block), "force");
    }
  });


}

















