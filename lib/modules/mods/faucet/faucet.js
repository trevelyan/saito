var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');



//////////////////
// CONSTRUCTOR  //
//////////////////
function Faucet(app) {

  if (!(this instanceof Faucet)) { return new Faucet(app); }

  Faucet.super_.call(this);

  this.app             = app;

  this.name            = "Faucet";
  this.browser_active  = 0;
  this.handlesEmail    = 0;

  return this;

}
module.exports = Faucet;
util.inherits(Faucet, ModTemplate);









////////////////////
// Install Module //
////////////////////
Faucet.prototype.installModule = function installModule() {

  if (this.app.BROWSER == 1) { return; }

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_faucet (\
                id INTEGER, \
                publickey TEXT, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

}







/////////////////////////
// Handle Web Requests //
/////////////////////////
Faucet.prototype.webServer = function webServer(app, expressapp) {

  var faucet_self = this;

  expressapp.get('/faucet/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/faucet/success', function (req, res) {

    if (faucet_self.app.wallet.returnBalance() < 50) {
      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("Our server does not have enough Saito to complete this sale. Please check back later.");
      res.end();
      return;
    }

    if (req.query.saito_address == null) {
      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("NO SAITO ADDRESS PROVIDED - FORM IMPROPERLY SUBMITTED");
      res.end();
      return;
    }

    var saito_address              = req.query.saito_address;
    
    // insert into database
    var unixtime = new Date().getTime();
    var unixtime_check = unixtime - 86400000;

    var sql = "SELECT count(*) AS count FROM mod_faucet WHERE publickey = $publickey AND unixtime > $unixtime";
    var params = { $publickey : saito_address , $unixtime : unixtime_check }
    faucet_self.app.storage.queryDatabase(sql, params, function(err, rows) {

      var can_send = 0;

      if (rows != null) {
        if (rows.count == 0) {
	  can_send = 1;
	}
      }

      if (can_send == 0) {
        res.sendFile(__dirname + '/web/failure.html');
        return;
      } else {

        // update database
        var sql2 = "INSERT INTO mod_faucet (publickey, unixtime) VALUES ($publickey, $unixtime)";
        var params2 = { $publickey : saito_address , $unixtime : unixtime }
        faucet_self.app.storage.queryDatabase(sql2, params2, function(err, rows) {});

        // send an email
        newtx = faucet_self.app.wallet.createUnsignedTransactionWithFee(saito_address, 100.0, 2.0);
        if (newtx == null) { return; }
        newtx.transaction.msg.module = "Email";
        newtx.transaction.msg.title  = "Saito Faucet - Transaction Receipt";
        newtx.transaction.msg.data   = 'You have received 100 tokens from our Saito faucet.';

        newtx = faucet_self.app.wallet.signTransaction(newtx);
        faucet_self.app.blockchain.mempool.addTransaction(newtx);
        faucet_self.app.network.propagateTransaction(newtx);

        res.sendFile(__dirname + '/web/success.html');
        return;
      }

    });
  });
  expressapp.get('/faucet/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}







///////////////////
// Attach Events //
///////////////////
Faucet.prototype.attachEvents = function attachEvents(app) {

      if (app.BROWSER == 0) { return; }
 
      var faucet_self = this;

}





Faucet.prototype.initializeHTML = function initializeHTML(app) {
    $('#saito_address').val(app.wallet.returnPublicKey());
}





