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

  this.name            = "Payment";
  this.browser_active  = 0;
  this.handlesEmail    = 1;

  // payment options
  this.ethereum_enabled        = 1;
  this.ethereum_latest_block   = 0;
  this.ethereum_seller_address = "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae";
  this.ethereum_apikey         = "";  //etherscan.io
  this.ethereum_api_url        = "http://api.etherscan.io/api?";
  this.ethereum_amount         = 100000000000000; // 0.0001 ETH - cost of 25 Saito
  this.saito_amount            = 25;
  this.saito_fee               = 2;

  return this;

}
module.exports = Payment;
util.inherits(Payment, ModTemplate);


////////////////
// Initialize //
////////////////
Payment.prototype.initialize = function initialize() {
  this.publickey = this.app.wallet.returnPublicKey();
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
                ethereum TEXT, \
                payment INTEGER, \
                amount INTEGER, \
                price INTEGER, \
                sent INTEGER, \
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
<div style="font-size:1.4em;padding:40px;"> \
Purchase Saito Tokens: \
<p></p> \
To purchase Saito tokens, please visit our <a href="/subscribe">token purchase page</a>. \
</div> \
<style> \
';
  element_to_edit.html(element_to_edit_html);

}









/////////////////////////
// Handle Web Requests //
/////////////////////////
Payment.prototype.webServer = function webServer(app, expressapp) {

  var payment_self = this;

  expressapp.get('/payment/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/payment/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });


  ///////////////////////
  // Ethereum Payments //
  ///////////////////////
  expressapp.get('/payment/ethereum', function (req, res) {

    var saito_buyer     = req.query.saito_buyer;
    var ethereum_buyer  = req.query.ethereum_buyer;
    var ethereum_seller = payment_self.ethereum_seller_address;
    var amount          = payment_self.ethereum_amount;

    if (saito_buyer == null || ethereum_buyer == null) {

      res.setHeader('Content-type', 'text/html');
      res.charset = 'UTF-8';
      res.write("ETHEREUM ADDRESS OR SAITO ADDRESS NOT PROVIDED: ");
      res.end();
      return;

    } else {

      var sql    = "INSERT INTO mod_payments (publickey, ethereum, amount) VALUES ($saito_buyer, $ethereum_buyer, $amount)";
      var params = { $saito_buyer : saito_buyer, $ethereum_buyer: ethereum_buyer, $amount : amount };
      app.storage.execBlockchain(sql, params, function(err, row) {

console.log(err);
console.log(sql);
console.log(params);

        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        res.write(payment_self.returnEthereumHTML(saito_buyer, ethereum_buyer, ethereum_seller));
        res.end();
        return;

      });

    };
  });
  expressapp.get('/payment/ethereum/confirm', function (req, res) {

    var saito_buyer              = req.query.saito_buyer;
    var ethereum_buyer           = req.query.ethereum_buyer;
    var ethereum_seller          = payment_self.ethereum_seller_address;
    var ethereum_purchase_amount = payment_self.ethereum_amount;
    var saito_amount             = payment_self.saito_amount;
    var saito_fee                = payment_self.saito_fee;

    var module     = "account";
    var action     = "txlist";
    var address    = "0xddbd2b932c763ba5b1b7ae3b362eac3e8d40121a";
    var startblock = 0;
    var endblock   = 99999999;
    var sort       = "asc";
    var apikey     = "YourApiKeyToken";

    var url = payment_self.ethereum_api_url + "module=" + module + "&action=" + action + "&address=" + address + "&startblock=" + startblock + "&endblock=" + endblock + "&sort=" + sort + "&apikey=" + apikey;

    request.get(url, (error, response, body) => {

      var json = JSON.parse(body);
      var tx_found = 0;

      for (var jsonind = 0; jsonind < json.result.length; jsonind++) {

        var ethtx = {};
            ethtx.blockNumber = json.result[jsonind].blockNumber;
            ethtx.from        = json.result[jsonind].from;
            ethtx.to          = json.result[jsonind].to;
            ethtx.value       = json.result[jsonind].value;
            ethtx.error       = json.result[jsonind].isError;

        if (ethereum_buyer == ethtx.from) {
          console.log("Transaction found from: "+ethereum_buyer);
          if (ethtx.value == ethereum_purchase_amount) {
            tx_found = 1;
            console.log("Transaction found: "+ethereum_purchase_amount);
          }
        }

        console.log(ethtx);

      }
      if (tx_found == 1) {

        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        res.write(payment_self.returnEthereumConfirmationHTML(saito_buyer, ethereum_buyer, ethereum_seller));
        res.end();

        // send email using local publickey
        newtx = payment_self.app.wallet.createUnsignedTransactionWithFee(saito_buyer, saito_amount, saito_fee);
        newtx = payment_self.app.modules.formatEmailTransaction(newtx, modsel);
        newtx = payment_self.app.wallet.signTransaction(newtx);
        payment_self.app.blockchain.mempool.addTransaction(newtx);
        payment_self.app.network.propagateTransaction(newtx);

        var sql2    = "UPDATE mod_payments SET sent = 1 WHERE publickey = $saito_buyer AND ethereum = $ethereum_buyer AND amount = $amount";
        var params2 = { $saito_buyer : saito_buyer, $ethereum_buyer: ethereum_buyer, $amount : amount };
        app.storage.execBlockchain(sql2, params2, function(err, row) {});

        return;

      } else {

        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        res.write("TRANSACTION NOT FOUND OR API NOT WORKING. Please email us: david@popupchinese.com -- include reference information for payment sent and we will handle your payment manually");
        res.end();

        return;

      }
    });
  });

}
Payment.prototype.returnEthereumHTML = function returnEthereumHTML(saito_buyer, ethereum_buyer, ethereum_seller) {

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
      Waiting for payment. Please send '+(this.ethereum_amount/1000000000000000000)+' ETH to the following address: \
      <p></p> \
      '+ethereum_seller+' \
      <p></p> \
      <b>Once your payment has received a single confirmation</b>, please click the link below to receive '+this.saito_amount+' Saito. \
      <p></p> \
      <a href="/payment/ethereum/confirm?saito_buyer='+saito_buyer+'&ethereum_buyer='+ethereum_buyer+'">Click here to complete payment.</a> \
      <p></p> \
      If you have any issues making your purchase, please contact David at &lt;david@satoshi&gt; or &lt;david@popupchinese.com&gt; \
    </div> \
\
</body> \
</html>';

}
Payment.prototype.returnEthereumConfirmationHTML = function returnEthereumConfirmationHTML(buyerSaitoAddress, buyerEthereumAddress, sellerEthereumAddress) {

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
      Saito has been sent to your account. If you have any issues please contact David at &lt;david@satoshi&gt; or &lt;david@popupchinese.com&gt; \
    </div> \
\
</body> \
</html>';

}




