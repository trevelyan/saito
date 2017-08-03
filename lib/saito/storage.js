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
        CREATE TABLE IF NOT EXISTS payslips (\
                id INTEGER, \
                block_id INTEGER, \
                tx_id INTEGER, \
                payslip_id INTEGER, \
                payslip_json TEXT, \
                address TEXT, \
                amount NUMERIC, \
                spent INTEGER, \
                UNIQUE (payslip_json), \
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
    $block_id: blk.block.header.id,
    $block: JSON.stringify(blk.block),
    $hash: blk.hash('hex')
  });

  for (b = 0; b < blk.transactions.length; b++) {
    this.saveTransaction(blk.block.header.id, blk.transactions[b]);
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

  for (bb = 0; bb < tx.transaction.payment.to.length; bb++) {
    this.saveSlip(block_id, tx.transaction.id, bb, JSON.stringify(tx.transaction.payment.to[bb]), tx.transaction.payment.to[bb]);
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
      console.log("REPOPULATING INDEX w/: "+ rows[sqlr].hash + " (" + blk.block.header.unixtime + ")");
      // the "force" argument ensures the block is added even if it comes before
      // the block that we think is our earliest block. This is used when initializing
      // our index
      storage_self.app.blockchain.indexAndStore(new saito.block(storage_self.app, rows[sqlr].block), "force");
    }
  });


}







