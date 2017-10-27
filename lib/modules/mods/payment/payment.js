var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
console.log("1");
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

  return this;

}
module.exports = Payment;
util.inherits(Payment, ModTemplate);


////////////////
// Initialize //
////////////////
Payment.prototype.initialize = function initialize() {

  // fetch the latest block so we don't crush our poor API provider
  var sql = "SELECT max(block_id) AS block_id WHERE ethereum != \"\"";
  var params = {};
  this.app.storage.queryDatabase(sql, params, function(err, row) {
    if (row != null) {
      this.ethereum_latest_block = row.block_id;
    };
  });

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
<a href="/payment?saito_buyer='+app.wallet.returnPublicKey()+'&saito_identifier='+app.wallet.returnIdentifier()+'">Click here to purchase SAITO tokens from our server</a>. \
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

    if (req.query.saito_buyer == null) {
      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("FORM NOT PROPERLY SUBMITTED");
      res.end();
      return;
    }

    var saito_buyer              = req.query.saito_buyer;
    var ethereum_pubkey          = "0x123";
    var ethereum_privkey         = "0x123";
    var unixtime                 = new Date().getTime();
    var amount                   = payment_self.ethereum_amount;

    var sql    = "INSERT INTO mod_payments (publickey, ethereum_pubkey, ethereum_privkey, amount, unixtime, payment_received, tokens_sent) VALUES ($saito_buyer, $ethereum_pubkey, $ethereum_privkey, $amount, $unixtime, $payment_received, $tokens_sent)";
    var params = { 	$saito_buyer : saito_buyer, 
			$ethereum_pubkey: ethereum_pubkey, 
			$ethereum_privkey: ethereum_privkey, 
			$amount : amount, 
			$unixtime : unixtime,
			$payment_received: 0, 
			$tokens_sent : 0 
    };
    app.storage.execBlockchain(sql, params, function(err, row) {

      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write(payment_self.returnEthereumHTML(saito_buyer, ethereum_pubkey, unixtime));
      res.end();

      // send an email
      newtx = payment_self.app.wallet.createUnsignedTransactionWithFee(saito_buyer, 0.0, 0.0001);
      newtx.transaction.msg.module = "Email";
      newtx.transaction.msg.title  = "Token Purchase Request";
      newtx.transaction.msg.data   = 'You have requested the purchase of '+payment_self.saito_amount+' tokens. This requires your  \
				     sending '+(payment_self.ethereum_amount/1000000000000000000)+' ETH to the following address:\
				     <p></p> 										    \
				     '+ethereum_pubkey+'						    \
				     <p></p>											    \
			             Once this payment has received three confirmations, <a href="'+payment_self.server_address+'ethereum/confirm?unixtime='+unixtime+'&saito_buyer='+saito_buyer+'&ethereum_pubkey='+ethereum_pubkey+'">click here to complete your purchase</a> \
					';
        newtx = payment_self.app.wallet.signTransaction(newtx);
        payment_self.app.blockchain.mempool.addTransaction(newtx);
        payment_self.app.network.propagateTransaction(newtx);
        return;

      });

  });
  expressapp.get('/payment/ethereum/confirm', function (req, res) {

    if (req.query.saito_buyer == null || req.query.ethereum_pubkey == null || req.query.unixtime == null) {
      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("FORM NOT PROPERLY SUBMITTED");
      res.end();
      return;
    }

    var saito_buyer              = req.query.saito_buyer;
    var ethereum_pubkey          = req.query.ethereum_pubkey;
    var unixtime                 = req.query.unixtime;
    var amount                   = payment_self.saito_amount;

    var apiurl     = payment_self.ethereum_api_url;
    var address    = payment_self.ethereum_seller_address;
    var startblock = payment_self.ethereum_latest_block;
    var apikey     = payment_self.ethereum_apikey;
    var module     = "account";
    var action     = "txlist";
    var endblock   = 99999999;
    var sort       = "asc";

    var url = apiurl + "module=" + module + "&action=" + action + "&address=" + address + "&startblock=" + startblock + "&endblock=" + endblock + "&sort=" + sort + "&apikey=" + apikey;

    request.get(url, (error, response, body) => {

      var json = JSON.parse(body);
      var tx_found = 0;

      for (var jsonind = 0; jsonind < json.result.length && tx_found == 0; jsonind++) {

        var ethtx = {};
            ethtx.blockNumber = json.result[jsonind].blockNumber;
            ethtx.from        = json.result[jsonind].from;
            ethtx.to          = json.result[jsonind].to;
            ethtx.value       = json.result[jsonind].value;
            ethtx.error       = json.result[jsonind].isError;

        if (ethereum_buyer.toUpperCase() == ethtx.from.toUpperCase()) {
          if (ethtx.value >= ethereum_purchase_amount) {
              tx_found = 1;
	      // update database with new block_id
              payment_self.ethereum_latest_block = ethtx.blockNumber;
	      var sql2 = "UPDATE mod_payments SET block_id = $block_id WHERE ethereum LIKE BINARY $ethereum_address AND publickey LIKE BINARY $saito_address AND unixtime = $unixtime";
              var params2 = { $block_id : ethtx.blockNumber , $ethereum_address : ethereum_buyer , $saito_address : saito_buyer , $unixtime : purchase_ts };
              app.storage.queryDatabase(sql2, params2, function() {});
          }
        }
      }
      if (tx_found == 1) {

        var sql3    = "SELECT count(*) AS count FROM mod_payments WHERE publickey = $saito_buyer AND ethereum = $ethereum_buyer AND amount = $amount AND unixtime = $unixtime AND tokens_sent = 0";
        var params3 = { $saito_buyer : saito_buyer, $ethereum_buyer: ethereum_buyer, $amount : ethereum_purchase_amount, $unixtime : purchase_ts };
        app.storage.queryBlockchain(sql3, params3, function(err, row) {        
	  if (row != null) {
	    if (row.count > 0 && (app.wallet.returnBalance() > (saito_amount+saito_fee))) {

              res.setHeader('Content-type', 'text/html');
              res.charset = 'UTF-8';
              res.write(payment_self.returnEthereumConfirmationHTML(saito_buyer, ethereum_buyer, ethereum_seller, purchase_ts)); 
              res.end();

              // send email using local publickey
              newtx = payment_self.app.wallet.createUnsignedTransactionWithFee(saito_buyer, saito_amount, saito_fee);
	      newtx.transaction.msg.module = "Email";
              newtx.transaction.msg.data  = "Your recent purchase of "+payment_self.saito_amount+" token(s) has been processed by the network";
              newtx.transaction.msg.title  = "Purchase Complete";
              newtx = payment_self.app.wallet.signTransaction(newtx);

              payment_self.app.blockchain.mempool.addTransaction(newtx);
              payment_self.app.network.propagateTransaction(newtx);

              var sql2    = "UPDATE mod_payments SET payment_received = 1, tokens_sent = 1 WHERE publickey = $saito_buyer AND ethereum = $ethereum_buyer AND amount = $amount AND unixtime = $unixtime";
              var params2 = { $saito_buyer : saito_buyer, $ethereum_buyer: ethereum_buyer, $amount : saito_amount , $unixtime : purchase_ts };
              app.storage.execBlockchain(sql2, params2, function(err, row) {});

              return;
	    } 
	    else {

              res.setHeader('Content-type', 'text/html');
              res.charset = 'UTF-8';
              res.write("TRANSACTION NOT FOUND #4312 -- if you have just made payment, please wait a few minutes and reload to give our API time to catch up. If your payment cannot be found 30 minutes after payment, please contact the operator of this server.");
              res.end();
              return;

            }
	  } else {

            res.setHeader('Content-type', 'text/html');
            res.charset = 'UTF-8';
            res.write("TRANSACTION NOT FOUND #3124 -- if you have just made payment, please wait a few minutes and reload to give our API time to catch up. If your payment cannot be found 30 minutes after payment, please contact the operator of this server.");
            res.end();
            return;

          }
        });

      } else {

        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        res.write("TRANSACTION NOT FOUND #1432 -- if you have just made payment, please wait a few minutes and reload to give our API time to catch up. If your payment cannot be found 30 minutes after payment, please contact the operator of this server.");
        res.end();
        return;

      }
    });
  });
}

Payment.prototype.returnEthereumHTML = function returnEthereumHTML(saito_buyer, ethereum_pubkey, unixtime) {

  var payment_self = this;

  var pagehtml = '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Blockchain Explorer</title> \
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
        <div style="font-family:Georgia;padding-top:0px;font-size:1.2em;color:#444;">saito</div> \
      </a> \
    </div> \
\
  <div class="main">';

  if (this.app.wallet.returnBalance() <= (this.saito_amount + this.saito_fee)) {

    pagehtml += 'Our server does not have enough Saito to complete this sale. Please check back later or write us.';

  } else {
    pagehtml += ' \
      <h2>Waiting for Payment</h2> \
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
      <b>Our server should send your SAITO within a few minutes of yourp payment confirming. If you have not received your tokens after <b>three confirmations</b> <a href="/payment/ethereum/confirm?unixtime='+unixtime+'&saito_buyer='+saito_buyer+'&ethereum_pubkey='+ethereum_pubkey+'">click here to complete your transaction</a>. \
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
        <div style="font-family:Georgia;padding-top:0px;font-size:1.2em;color:#444;">saito</div> \
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




