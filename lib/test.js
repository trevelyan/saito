
var sqlite3 = require('sqlite3').verbose();
this.db = new sqlite3.Database('./data/database.sq3');

storage_self = this;

this.db.serialize(function() {

  // transactions
  var sql = "SELECT block_id FROM blocks";
  storage_self.db.all(sql, {}, function (err, rows) {
    console.log(rows);
  });

  var sql = "SELECT block_id FROM txs";
  storage_self.db.all(sql, {}, function (err, rows) {
    console.log(rows);
  });




});


