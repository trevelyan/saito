var saito   = require('../saito');
var fs      = require('fs');


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

  if (this.app.BROWSERIFY == 0) {
    var sqlite3 = require('sqlite3').verbose();
    this.db = new sqlite3.Database('./data/database.sq3');
    this.createDatabaseTables();
  }

  this.loadOptions();

}






///////////////////////////////////////////
// Saving and Loading Configuration File //
///////////////////////////////////////////
Storage.prototype.loadOptions = function loadOptions() {

  if (this.app.BROWSERIFY == 0) {
    ///////////////////////
    // local config file //
    ///////////////////////
    try {
      this.app.options = JSON.parse(
        fs.readFileSync('options', 'utf8', (err, data) => {
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
    storage_self = this;
    data = null;
    //////////////////////////////
    // or local browser storage //
    //////////////////////////////
    if (typeof(Storage) !== "undefined") {
     //data = localStorage.getItem("options");
     //this.app.options = JSON.parse(data);
    }
    if (data == null) {
      ///////////////
      // or server //
      ///////////////
      $.ajax({
        url: 'client.json',
        dataType: 'json',
        async: false,
        success: function(data) {
          storage_self.app.options = data;
        }
      });
    }
  }
}
Storage.prototype.saveOptions = function saveOptions() {


  // if anything is missing, create it
  if (this.app.options.wallet == null) {
    this.app.options.wallet  = this.app.wallet.returnWallet();
  }
  if (this.app.options.network == null) {
    this.app.options.network = this.app.network.returnNetwork();
  }
  if (this.app.options.server == null) {
    this.app.options.server  = this.app.server.returnServer();
  }




  if (this.app.BROWSERIFY == 0) {
    fs.writeFileSync("options", JSON.stringify(this.app.options), function(err) {
      if(err) {
          return console.log(err);
      }
    });

    this.saveClientOptions();

  } else {

    // local browser storage
    if (typeof(Storage) !== "undefined") {

      // light clients update last block processed
      if (this.app.blockchain != null) {
        if (this.app.blockchain.returnLatestBlock() != null) {
          this.app.options.lastblock = this.app.blockchain.returnLatestBlock().returnId();
        }
      }
      localStorage.setItem("options", JSON.stringify(this.app.options));
    }
  }

}
Storage.prototype.saveClientOptions = function saveClientOptions() {

console.log("saving client options");

  if (this.app.BROWSERIFY == 1) { return; }

  // produce a version of our options file for distribution to web clients
  // this should contain information on our available mods as well as help
  // on how to connect to our server.
  //
  // this should only be used by clients the first time they connect, after
  // that they will generate their own keys and save their own copy of the
  // file locally, in which case they will not request our giving them this
  // file.


  tmpjson          = {};
  tmpjson.messages = {};
  tmpjson.modules  = {};
  // set client peer list to OUR SERVER
  //
  // note that network is a list of peers
  // whereas server is a single itms, so 
  // we have to manually make network an 
  // array and push back our server
  //
  tmpjson.network  = [];
  tmpjson.network.push(this.app.server.returnServer());
  tmpjson.wallet   = new saito.wallet().returnWallet();

  fs.writeFileSync("saito/web/client.json", JSON.stringify(tmpjson), function(err) {
    if (err) {
      return console.log(err);
    }
  });

}









///////////////////////////////////
// Database Management Functions //
///////////////////////////////////
Storage.prototype.createDatabaseTables = function createDatabaseTables() {

  if (this.app.BROWSERIFY == 1) { return; }

  this.db.exec("\
        CREATE TABLE IF NOT EXISTS blocks (\
                id INTEGER, \
                block_id INTEGER, \
                block TEXT, \
                hash TEXT, \
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
                slip_json TEXT, \
                address TEXT, \
                amount NUMERIC, \
                spent INTEGER, \
                UNIQUE (slip_json), \
                PRIMARY KEY(id ASC) \
        )");

  // for faster and more convenient access to the transactions
  // that directly affect us, we keep a separate table storing
  // any transactions/messages that are sent to us.
  this.db.exec("\
        CREATE TABLE IF NOT EXISTS messages (\
                id INTEGER, \
                tx_id INTEGER, \
                tx TEXT, \
                UNIQUE (tx), \
                PRIMARY KEY(id ASC) \
        )");

}
///////////////////////
// Write to Database //
///////////////////////
Storage.prototype.saveBlock = function saveBlock(blk) {

  if (this.app.BROWSERIFY == 1) { return; }

  sql = "INSERT OR IGNORE INTO blocks (block_id, block, hash) VALUES ($block_id, $block, $hash)";
  this.db.run(sql, {
    $block_id: blk.block.id,
    $block: JSON.stringify(blk.block),
    $hash: blk.hash('hex')
  });

  for (b = 0; b < blk.transactions.length; b++) {
    this.saveTransaction(blk.block.id, blk.transactions[b]);
  }

}
Storage.prototype.saveTransaction = function saveTransaction(block_id, tx) {

  if (this.app.BROWSERIFY == 1) { return; }

  sql = "INSERT OR IGNORE INTO txs (block_id, tx_id, tx) VALUES ($block_id, $tx_id, $tx)";
  this.db.run(sql, {
    $block_id: block_id,
    $tx_id: tx.transaction.id,
    $tx: JSON.stringify(tx.transaction)
  });

  for (bb = 0; bb < tx.transaction.to.length; bb++) {
    this.saveSlip(block_id, tx.transaction.id, bb, JSON.stringify(tx.transaction.to[bb]), tx.transaction.to[bb]);
  }

}
Storage.prototype.saveSlip = function saveSlip(block_id, tx_id, slip_id, slip_json, slip) {

  if (this.app.BROWSERIFY == 1) { return; }

  sql = "INSERT OR IGNORE INTO slips (block_id, tx_id, slip_id, slip_json, address, amount, spent) VALUES ($block_id, $tx_id, $slip_id, $slip_json, $address, $amount, $spent)";
  this.db.run(sql, {
    $block_id: block_id,
    $tx_id: tx_id,
    $slip_id: slip_id,
    $slip_json: slip_json,
    $address: slip.address,
    $amount: slip.amount,
    $spent: 0
  });

}
Storage.prototype.saveMessage = function saveMessage(tx) {

  if (this.app.BROWSERIFY == 1) {

    // browsers store messages in browser cache
    if (this.app.options["Messages"] == null) { this.app.options["Messages"] = []; }
    this.app.options["Messages"].push(JSON.stringify(tx.transaction));
    this.saveOptions();

  } else {

    // servers store in database
    sql = "INSERT OR IGNORE INTO messages (tx_id, tx) VALUES ($tx_id, $tx)";
    this.db.run(sql, {
      $tx_id: tx.transaction.id,
      $tx: JSON.stringify(tx.transaction)
    });

  }

}











////////////////////////
// Read from Database //
////////////////////////
Storage.prototype.indexRecentBlocks = function indexRecentBlocks(mylimit=10) {

  if (this.app.BROWSERIFY == 1) { return; }

  storage_self = this;

  sql = "SELECT * FROM blocks ORDER BY block_id ASC LIMIT $blimit"
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









Storage.prototype.purgeOldBlocks = function purgeOldBlockk(blkid) {

  // browser apps dump old data
  if (this.app.BROWSERIFY == 1) { return; }

  sql1 = "DELETE FROM blocks WHERE block_id < $block_id";
  this.db.run(sql1, {
    $block_id: blkid
  });

  sql2 = "DELETE FROM txs WHERE block_id < $block_id";
  this.db.run(sql2, {
    $block_id: blkid
  });

  sql3 = "DELETE FROM slips WHERE block_id < $block_id";
  this.db.run(sql3, {
    $block_id: blkid
  });


}







