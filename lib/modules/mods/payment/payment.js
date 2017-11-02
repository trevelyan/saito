var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var request = require("request");







//////////////////
// CONSTRUCTOR  //
//////////////////
function Payment(app) {

  if (!(this instanceof Payment)) { return new Payment(app); }

  Payment.super_.call(this);

  this.app             = app;


  // this is the name that shows up in the 
  // email module.
  this.name            = "Payment";

  this.browser_active  = 0;
  this.handlesEmail    = 1;
  this.emailAppName    = "Purchase Tokens";

  // payment options
  this.ethereum_enabled        = 1;
  this.ethereum_latest_block   = 0;



  ///////////////////////////
  // EDIT THIS INFORMATION //
  ///////////////////////////
  this.server_address          = "http://localhost:12100/payment/";			// where users go to buy Saito;
  this.ethereum_seller_address = "0x923061C1f4e4c2701e6b2D4b64a4065cdf107c71";		// YOUR address for receiving payments
  this.ethereum_apikey         = "77JDUGS3YFC4RYUG577QJQPGQR8IBXQD44";  		// SaitoTech API Key
  this.ethereum_api_url        = "http://api.etherscan.io/api?";			// Ethereum API URL
  this.ethereum_amount         = 100000000000000; // 0.0001 ETH - cost of 25 Saito	// selling price
  this.saito_amount            = 25;							// selling amount
  this.saito_fee               = 2;							// fee per transaction


  ///////////////
  // API Timer //
  ///////////////
  //
  // we check outstanding payments once every 2 minutes
  this.ethereum_timer       = null;
  this.ethereum_timer_speed = 20000;


  return this;

}
module.exports = Payment;
util.inherits(Payment, ModTemplate);


////////////////
// Initialize //
////////////////
Payment.prototype.initialize = function initialize() {

  var payment_self = this;


  // fetch the latest block so we don't crush our poor API provider
  var sql = "SELECT max(block_id) AS block_id WHERE ethereum != \"\"";
  var params = {};
  this.app.storage.queryDatabase(sql, params, function(err, row) {
    if (row != null) {
      this.ethereum_latest_block = row.block_id;
    };
  });



  // set the timer
  this.ethereum_timer = setInterval(function() {

console.log("ethereum timer loop...");

    var unixtime       = new Date().getTime();
    var unixtime_limit = unixtime - 3600000;

    var sql = "SELECT * FROM mod_payments WHERE payment_received = 0 AND unixtime > $unixtime_limit AND waiting_for_payment = 1 AND times_checked < 10";
    var params = { $unixtime_limit : unixtime_limit }
    payment_self.app.storage.queryDatabaseArray(sql, params, function(err, rows) {
      if (rows != null) {
        for (var i = 0; i < rows.length; i++) {
          var payment_to_check = rows[i];

	  payment_self.checkEthereumApi(payment_self.app, rows[i].id, rows[i].ethereum_pubkey, rows[i].publickey, payment_self.saito_amount, payment_self.saito_fee);

	  console.log("\n\nWE ARE SUPPOSED TO CHECK THE STATUS OF THIS PAYMENT: ");
	  console.log(payment_to_check);
	  console.log("\n\n");

    	  var sql2 = "UPDATE mod_payments SET times_checked = times_checked+1 WHERE id = $id";
    	  var params2 = { $id : rows[i] }
    	  payment_self.app.storage.execDatabase(sql2, params2, function(err, rows) {});

        }
      }
    });
  }, this.ethereum_timer_speed);

}


////////////////////
// Install Module //
////////////////////
Payment.prototype.installModule = function installModule() {

  if (this.app.BROWSER == 1) { return; }

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_payments (\
                id INTEGER, \
                publickey TEXT, \
                ethereum_pubkey TEXT, \
                ethereum_privkey TEXT, \
                amount TEXT, \
                payment_received INTEGER, \
                tokens_sent INTEGER, \
                unixtime INTEGER, \
                last_checked INTEGER, \
                times_checked INTEGER, \
                waiting_for_payment INTEGER, \
                tx TEXT, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

}








////////////////////////
// Display Email Form //
////////////////////////
Payment.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = ' \
<div style="font-size:1.4em;padding:40px;padding-top:0px;line-height:1.8em;"> \
<h2>Purchase Tokens:</h2> \
<p></p> \
<a href="/payment?saito_address='+app.wallet.returnPublicKey()+'">Click here to purchase SAITO tokens from our server</a>. \
</div> \
<style> \
';
  element_to_edit.html(element_to_edit_html);

  // auto-input correct address and payment amount
  $('.lightbox_compose_address_area').hide();
  $('.lightbox_compose_module').hide();

}









/////////////////////////
// Handle Web Requests //
/////////////////////////
Payment.prototype.webServer = function webServer(app, expressapp) {

  var payment_self = this;


  ///////////////////////
  // Ethereum Payments //
  ///////////////////////
  expressapp.get('/payment/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.get('/payment', function (req, res) {

    if (req.query.saito_address == null) {
      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("FORM NOT PROPERLY SUBMITTED");
      res.end();
      return;
    }

    var saito_address            = req.query.saito_address;
    var tmpkeys = payment_self.generateEthereumKeys();
    var ethereum_pubkey          = tmpkeys.public;
    var ethereum_privkey         = tmpkeys.private;
    var unixtime                 = new Date().getTime();
    var amount                   = payment_self.ethereum_amount;

    var sql    = "INSERT INTO mod_payments (publickey, ethereum_pubkey, ethereum_privkey, amount, unixtime, last_checked, times_checked, waiting_for_payment, payment_received, tokens_sent) VALUES ($saito_address, $ethereum_pubkey, $ethereum_privkey, $amount, $unixtime, $last_checked, $times_checked, $waiting_for_payment, $payment_received, $tokens_sent)";
    var params = { 	$saito_address : saito_address, 
			$ethereum_pubkey: ethereum_pubkey, 
			$ethereum_privkey: ethereum_privkey, 
			$amount : amount, 
			$unixtime : unixtime,
			$last_checked : 0,
			$times_checked : 0,
			$waiting_for_payment : 0,
			$payment_received: 0, 
			$tokens_sent : 0 
    };
    app.storage.execBlockchain(sql, params, function(err, row) {

      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write(payment_self.returnEthereumHTML(saito_address, ethereum_pubkey, unixtime));
      res.end();

      // send an email
      newtx = payment_self.app.wallet.createUnsignedTransactionWithFee(saito_address, 0.0, 0.0001);
      if (newtx == null) { return; }
      newtx.transaction.msg.module = "Email";
      newtx.transaction.msg.title  = "Saito Tokens - Purchase Request";
      newtx.transaction.msg.data   = 'You have requested the purchase of '+payment_self.saito_amount+' tokens. This requires your  \
				     sending '+(payment_self.ethereum_amount/1000000000000000000)+' ETH to the following address:\
				     <p></p> 										    \
				     '+ethereum_pubkey+'						    \
				     <p></p>											    \
			             If you have already made payment please be patient as our server processes this payment. If you not received your tokens after three confirmations, please <a href="'+payment_self.server_address+'confirm/ethereum?unixtime='+unixtime+'&saito_address='+saito_address+'&ethereum_pubkey='+ethereum_pubkey+'">click here to complete your purchase</a> \
					';
        newtx = payment_self.app.wallet.signTransaction(newtx);
        payment_self.app.blockchain.mempool.addTransaction(newtx);
        payment_self.app.network.propagateTransaction(newtx);
        return;

      });

  });
  expressapp.get('/payment/confirm/ethereum', function (req, res) {

    if (req.query.saito_address == null) {
      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("FORM NOT PROPERLY SUBMITTED");
      res.end();
      return;
    }

    var saito_address            = req.query.saito_address;
    var ethereum_pubkey          = req.query.ethereum_pubkey;
    var unixtime                 = req.query.unixtime;
    var amount                   = payment_self.saito_amount;
    var fee                      = payment_self.saito_fee;

    var sql    = "UPDATE mod_payments SET times_checked = 0, last_checked = 0, waiting_for_payment = 1 WHERE publickey = $saito_address AND ethereum_pubkey = $ethereum_pubkey AND unixtime = $unixtime";
    var params = { 	$saito_address : saito_address, 
			$ethereum_pubkey: ethereum_pubkey, 
			$unixtime: unixtime
    };
    app.storage.execDatabase(sql, params, function(err, row) {});


    // now check the API for this particular payment
    var sql2    = "SELECT * FROM mod_payments WHERE publickey = $saito_address AND ethereum_pubkey = $ethereum_pubkey AND unixtime = $unixtime AND waiting_for_payment = $waiting_for_payment";
    var params2 = { 	$saito_address : saito_address, 
			$ethereum_pubkey: ethereum_pubkey, 
			$unixtime: unixtime,
			$waiting_for_payment : 1
    };
    app.storage.queryDatabase(sql2, params2, function(err, row) {
      if (row != null) {
        payment_self.checkEthereumApi(payment_self.app, row.id, row.ethereum_pubkey, row.publickey, payment_self.saito_amount, payment_self.saito_fee);
      }
    });

    res.sendFile(__dirname + '/web/success.html');
    return;

  });
}









Payment.prototype.checkEthereumApi = function checkEthereumApi(app, mod_payments_id, address_to_check, saito_buyer, saito_amount, saito_fee) {

  var payment_self = this;

  var address    = address_to_check;
  var apiurl     = payment_self.ethereum_api_url;
  var startblock = 0;
  var apikey     = payment_self.ethereum_apikey;
  var module     = "account";
  var action     = "txlist";
  var endblock   = 9999999999;
  var sort       = "asc";

  var url = apiurl + "module=" + module + "&action=" + action + "&address=" + address + "&startblock=" + startblock + "&endblock=" + endblock + "&sort=" + sort + "&apikey=" + apikey;

  try {
    request.get(url, (error, response, body) => {

      var json = JSON.parse(body);
      var tx_found = 0;

console.log("CHECKED API, results: ");
console.log(json);

      for (var jsonind = 0; jsonind < json.result.length && tx_found == 0; jsonind++) {

        var ethtx = {};
            ethtx.blockNumber = json.result[jsonind].blockNumber;
            ethtx.from        = json.result[jsonind].from;
            ethtx.to          = json.result[jsonind].to;
            ethtx.value       = json.result[jsonind].value;
            ethtx.error       = json.result[jsonind].isError;

        // tell database we have received payment
        var sql2 = "UPDATE mod_payments SET waiting_for_payment = 0, tokens_sent = 1, payment_received = 1 WHERE id = $id";
        var params2 = { $id : mod_payments_id };
        app.storage.queryDatabase(sql2, params2, function() {});


        // send email and payment
        var saito_fee = payment_self.saito_fee;
	var saito_amount = payment_self.saito_amount; 

        newtx = payment_self.app.wallet.createUnsignedTransactionWithFee(saito_buyer, saito_amount, saito_fee);
    	if (newtx == null) {
          var sql3 = "UPDATE mod_payments SET waiting_for_payment = 0, tokens_sent = 0, payment_received = 1 WHERE id = $id";
          var params3 = { $id : mod_payments_id };
          app.storage.queryDatabase(sql3, params3, function() {});
	  return;
	}
	newtx.transaction.msg.module = "Email";
        newtx.transaction.msg.data  = "Your purchase of "+payment_self.saito_amount+" token(s) has been processed by the network";
        newtx.transaction.msg.title  = "Saito Tokens - Purchase Complete";
        newtx = payment_self.app.wallet.signTransaction(newtx);

        payment_self.app.blockchain.mempool.addTransaction(newtx);
        payment_self.app.network.propagateTransaction(newtx);

      }
    });
  } catch (err) {
    console.log("Could not check Ethereum API");
  }

}












Payment.prototype.generateEthereumKeys = function generateEthereumKeys() {

  var keythereum = require("keythereum");
  var params = { keyBytes: 32, ivBytes: 16 };
  var dk = keythereum.create(params);
  var options = {
    kdf: "pbkdf2",
    cipher: "aes-128-cbc",
    kdfparams: {
      c: 262144,
      dklen: 32,
      prf: "hmac-sha256"
    }
  };

  var password = "ethereum";
  var keyObject = keythereum.dump(password, dk.privateKey, dk.salt, dk.iv, options);

  var keys = {};
      keys.public  = "0x" + keyObject.address;
      keys.private = keythereum.recover(password, keyObject).toString('hex');

  return keys;

}





Payment.prototype.returnEthereumHTML = function returnEthereumHTML(saito_address, ethereum_pubkey, unixtime) {

  var payment_self = this;

  var pagehtml = '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Purchase Tokens</title> \
  <link rel="stylesheet" type="text/css" href="/payment/style.css" /> \
  <script type="text/javascript" src="/jquery/jquery-3.2.1.min.js" /></script> \
  <script type="text/javascript" src="/qrcode/qrcode.min.js" /></script> \
  <link rel="stylesheet" type="text/css" href="/payment/style.css" /> \
</head> \
<body> \
\
    <div class="header"> \
      <a href="/" style="text-decoration:none;color:inherits"> \
        <img src="/img/saito_logo_black.png" style="width:35px;margin-top:5px;margin-left:25px;margin-right:10px;float:left;" /> \
        <div style="font-family:Georgia;padding-top:6px;font-size:1.2em;color:#444;">saito</div> \
      </a> \
    </div> \
\
  <div class="main">';

  if (this.app.wallet.returnBalance() <= (this.saito_amount + this.saito_fee)) {

    pagehtml += 'Our server does not have enough Saito to complete this sale. Please check back later or write us.';

  } else {
    pagehtml += ' \
      <h2>Purchase '+this.saito_amount+' Tokens</h2> \
      <p></p> \
      Send '+(this.ethereum_amount/1000000000000000000)+' ETH to the following address: \
      <p></p> \
      <div id="qrcode"></div> \
      <script type="text/javascript"> \
        new QRCode(document.getElementById("qrcode"), "'+ethereum_pubkey+'"); \
      </script> \
      <br /> \
      '+ethereum_pubkey+' \
      <p></p> \
      <b>Once you have made payment, please <a href="/payment/confirm/ethereum?unixtime='+unixtime+'&saito_address='+saito_address+'&ethereum_pubkey='+ethereum_pubkey+'">click here to complete your transaction</a>. \
    </div> \
    ';

  }

  pagehtml += ' \
  </div> \
</body> \
</html>';

  return pagehtml;

}

Payment.prototype.returnEthereumConfirmationHTML = function returnEthereumConfirmationHTML(buyerSaitoAddress, buyerEthereumAddress, sellerEthereumAddress, purchase_ts) {

return '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Blockchain Explorer</title> \
  <link rel="stylesheet" type="text/css" href="/payment/style.css" /> \
</head> \
<body> \
\
    <div class="header"> \
      <a href="/" style="text-decoration:none;color:inherits"> \
        <img src="/img/saito_logo_black.png" style="width:35px;margin-top:5px;margin-left:25px;margin-right:10px;float:left;" /> \
        <div style="font-family:Georgia;padding-top:6px;font-size:1.2em;color:#444;">saito</div> \
      </a> \
    </div> \
\
    <div class="main"> \
      Saito has been sent to your account. If you have any issues please contact the server operator. \
      <p></p> \
      <a href="/email/">Click here for your email account</a>. \
    </div> \
\
</body> \
</html>';

}




