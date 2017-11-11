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

    if (req.query.saito_address == null) {
      res.sendFile(__dirname + '/web/index.html');
      return;
    }


    res.setHeader('Content-type', 'text/html');
    res.charset = 'UTF-8';
    res.write(faucet_self.returnFaucetHTML(req.query.saito_address));
    res.end();
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


Faucet.prototype.returnFaucetHTML = function returnFaucetHTML(saito_address) {

  var pagehtml = '<html><head><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content=""><meta name="author" content=""><title>Saito Token Faucet</title><script type="text/javascript" src="/jquery/jquery-3.2.1.min.js"></script><link rel="stylesheet" href="/jquery/jquery-ui.min.css" type="text/css" media="screen" /><script type="text/javascript" src="/jquery/jquery-ui.min.js"></script>  <link rel="stylesheet" type="text/css" href="/faucet/style.css" /></head><body>  <div class="header"><a href="/" style="text-decoration:none;color:inherits"><img src="/img/saito_logo_black.png" style="width:35px;margin-top:5px;margin-left:25px;margin-right:10px;float:left;" /><div style="font-family:Georgia;padding-top:6px;font-size:1.2em;color:#444;">saito</div></a></div><div class="main" id="main" style="">Click the button below to receive 100 Saito tokens:<p></p>(auto-filled with your browser\'s address)<p></p><form method="get" action="/faucet/success"><input type="text" style="padding:2px;width:640px" name="saito_address" id="saito_address" value="'+saito_address+'" /><p></p><input type="submit" id="faucet_button" class="faucet_button" /></form></div></body></html>';
  return pagehtml;

}





