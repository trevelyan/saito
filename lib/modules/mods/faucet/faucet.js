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
//
// This is a bit more complicated than it needs to be, because
// we want to be able to send users to the main Saito faucet if
// the application is not called with a Saito address.
//
// This design allows us to have links WITHIN our javascript bundle
// that point to off-server faucets but return people to the local
// URL (i.e. their URL-specific wallet).
// 
// This is designed for countries like China and other networks where
// firewalls can degrade large javascript downloads but otherwise 
// do not prevent connectivity.
Faucet.prototype.webServer = function webServer(app, expressapp) {

  var faucet_self = this;

  expressapp.get('/faucet/', function (req, res) {

    if (req.query.saito_address == null) {
      res.sendFile(__dirname + '/web/index.html');
      return;
    }

    var mobile_client = "no";
    if (req.query.mobile != null) {
      if (req.query.mobile === "yes") {
        mobile_client = "yes";
      }
    }

    var source_domain = "saito.tech";
    if (req.query.domain != null) {
      source_domain = req.query.domain;
    }

    var source_port = "12101";
    if (req.query.port != null) {
      source_port = req.query.port;
    }

    res.setHeader('Content-type', 'text/html');
    res.charset = 'UTF-8';
    res.write(faucet_self.returnFaucetHTML(req.query.saito_address, mobile_client, source_domain, source_port));
    res.end();
    return;

  });
  expressapp.get('/faucet/success', function (req, res) {

    var mobile_client = "no";
    if (req.query.mobile != null) {
      if (req.query.mobile == "yes") {
        mobile_client = "yes";
      }
    }

    var source_domain = "saito.tech";
    if (req.query.domain != null) {
      source_domain = req.query.domain;
    }

    var source_port = "12101";
    if (req.query.port != null) {
      source_port = req.query.port;
    }

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
        newtx = faucet_self.app.wallet.createUnsignedTransaction(saito_address, 100.0, 2.0);
        if (newtx == null) { return; }
        newtx.transaction.msg.module = "Email";
        newtx.transaction.msg.title  = "Saito Faucet - Transaction Receipt";
        newtx.transaction.msg.data   = 'You have received 100 tokens from our Saito faucet.';
        newtx = faucet_self.app.wallet.signTransaction(newtx);
        faucet_self.app.blockchain.mempool.addTransaction(newtx);
        faucet_self.app.network.propagateTransaction(newtx);


        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        res.write(faucet_self.returnFaucetSuccessHTML(mobile_client, source_domain, source_port));
        res.end();
        return;
      }

    });
  });
  expressapp.get('/faucet/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}





/////////////
// On Load //
/////////////
Faucet.prototype.initializeHTML = function initializeHTML(app) {
    $('#saito_address').val(app.wallet.returnPublicKey());
}







Faucet.prototype.returnFaucetHTML = function returnFaucetHTML(saito_address, mobile_client="no", source_domain="saito.tech", source_port="12101") {

  var pagehtml = '';

  pagehtml = '<html><head><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content=""><meta name="author" content=""><title>Saito Token Faucet</title><script type="text/javascript" src="/jquery/jquery-3.2.1.min.js"></script><link rel="stylesheet" href="/jquery/jquery-ui.min.css" type="text/css" media="screen" /><script type="text/javascript" src="/jquery/jquery-ui.min.js"></script>  <link rel="stylesheet" type="text/css" href="/faucet/style.css" /></head><body><div class="header"><a href="/" class="logo_link"><img src="/img/saito_logo_black.png" class="logo" /><div class="logo_text">saito</div></a></div><div class="main" id="main" style="">Click the button below to receive 100 Saito tokens:<p></p>(auto-filled with your browser\'s address)<p></p><form method="get" action="/faucet/success"><input type="text" style="padding:2px;width:640px" name="saito_address" id="saito_address" value="'+saito_address+'" /><input type="hidden" name="domain" value="'+source_domain+'" /><input type="hidden" name="port" value="'+source_port+'" /><input type="hidden" name="mobile" value="'+mobile_client+'" /><p></p><input type="submit" id="faucet_button" class="faucet_button" /></form></div></body></html>';

  return pagehtml;

}
Faucet.prototype.returnFaucetSuccessHTML = function returnFaucetSuccessHTML(mobile_client="no", source_domain="saito.tech", source_port="12101") {

  var mobile_link = "/email";
  if (mobile_client != "no") { mobile_link = "/email/mobile.html"; }

  return '<html><head><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content=""><meta name="author" content=""><title>Saito Token Faucet</title><script type="text/javascript" src="/jquery/jquery-3.2.1.min.js"></script><link rel="stylesheet" href="/jquery/jquery-ui.min.css" type="text/css" media="screen" /><script type="text/javascript" src="/jquery/jquery-ui.min.js"></script>  <link rel="stylesheet" type="text/css" href="/faucet/style.css" /></head><body><div class="header"><a href="/" class="logo_link"><img src="/img/saito_logo_black.png" class="logo" /><div class="logo_text">saito</div></a></div><div class="main" id="main" style=""><h2>Success:</h2><p></p>Our server has sent tokens to your Saito address.<p></p>It may take a few minutes for these tokens to arrive.<p></p><a href="http://'+source_domain+':'+source_port+mobile_link+'">Click here to return to our Satoshi Mail client</a>.</div></body></html>';

}


