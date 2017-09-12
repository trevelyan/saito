var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var fs = require('fs');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Secret(app) {

  if (!(this instanceof Secret)) { return new Secret(app); }

  Secret.super_.call(this);

  this.app             = app;

  this.name            = "Secret";
  this.browser_active  = 0;

  return this;

}
module.exports = Secret;
util.inherits(Secret, ModTemplate);


////////////////
// Initialize //
////////////////
Secret.prototype.initialize = function initialize() {

  if (this.app.BROWSER == 1) { return; }

  var server   = require('express')();
  var basicAuth = require('express-basic-auth');

  server.use(basicAuth({
    users: { 'secretuser': 'secretpass' },
    challenge: true,
    realm: '98523S243874'                          // random value
  }));

  server.get('/', function(request, response) {
    response.sendFile(__dirname + '/web/private.html');
    return;
  });
  server.get('/style.css', function(request, response) {
    response.sendFile(__dirname + '/web/style.css');
    return;
  });
  server.get('/img/saito_logo_black.png', function(request, response) {
    response.sendFile(__dirname + '/web/img/saito_logo_black.png');
    return;
  });


  server.listen(8080);

console.log("\n\n\n\nServer Setup");

}


////////////////////
// Install Module //
////////////////////
Secret.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_registry_addresses (\
                id INTEGER, \
                identifier TEXT, \
                publickey TEXT, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

}






//////////////////
// Confirmation //
//////////////////
Secret.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  if (tx.transaction.to[0].add != app.wallet.returnPublicKey()) { return; }

  // provide access on zero-conf
  if (conf == 0) {

    // only a server should proceed
    if (app.BROWSER == 1) { return; }

    if (tx.transaction.msg != null) {
      if (tx.transaction.msg.type.toLowerCase() == "access" && tx.returnAmountTo(app.wallet.returnPublicKey()) >= 5.0) {

        // send an email giving access
        to = tx.transaction.from[0].add;
        from = app.wallet.returnPublicKey();
        amount = 0.0;
        fee = 2.0;
        server_email_html = 'You can now access: \
<p></p> \
http://saito.tech:8080/ \
<p></p> \
Use the following login credentials: \
<p></p> \
user: secretuser \
<br /> \
pass: secretpass \
<p></p> \
';

        newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
        newtx.transaction.msg.module = "Email";
        newtx.transaction.msg.data   = server_email_html;
        newtx.transaction.msg.title  = "Server Access Granted!";
        newtx = app.wallet.signTransaction(newtx);
        app.blockchain.mempool.addTransaction(newtx);
        app.network.propagateTransaction(newtx);

      }
    }  

    return;
  }
}








/////////////////////////
// Handle Web Requests //
/////////////////////////
Secret.prototype.webServer = function webServer(app, expressapp) {

  server_self = this;

  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/secret/', function (req, res) {
    //rewrite indexHTML page
    fs.writeFileSync((__dirname + "/web/index.html"), server_self.returnIndexHTML(app), function(err) {
      if (err) {
        return console.log(err);
      }
    });
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/secret/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });


}




// we want to listen on AUTH requests since we use those to monitor access requests
Secret.prototype.shouldAffixCallbackToModule = function shouldAffixCallbackToModule(modname) {
  if (modname == this.name) { return 1; }
  if (modname == "Auth")    { return 1; }
  return 0;
}






Secret.prototype.returnIndexHTML = function returnIndexHTML(app) {

return '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Online Demo</title> \
  <link rel="stylesheet" type="text/css" href="/secret/style.css" /> \
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
      Saito can make any web-service anonymous and pay-for-access: \
      <p></p> \
      <div id="donation_address" class="donation_address">'+app.wallet.returnPublicKey()+'</div> \
      <p></p> \
      For access to our secret server, send 5 SAITO to the above address using the "auth" module (keyword: "access"). \
    </div> \
\
</body> \
</html>';

}




