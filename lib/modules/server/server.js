var saito       = require('../../saito');
var ModTemplate = require('../template');
var util        = require('util');
var fs          = require('fs');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Server(app) {

  if (!(this instanceof Server)) { return new Server(app); }
  Server.super_.call(this);

  this.app             = app;
  this.name            = "Server";

  this.initializeServer();

  return this;

}
module.exports = Server;
util.inherits(Server, ModTemplate);




//////////////////////////////////////////////////////////////
// Custom Initialization Function Referenced in Constructor //
//////////////////////////////////////////////////////////////
Server.prototype.initializeServer = function initializeServer() {

  if (this.app.BROWSERIFY == 1) { return; }

  var server   = require('express')();
  var basicAuth = require('express-basic-auth');

  server.use(basicAuth({
    users: { 'secretuser': 'secretpass' },
    challenge: true,
    realm: '987AS243874'                        // change this value
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

}





////////////////////
// Install Module //
////////////////////
Server.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_server (\
                id INTEGER, \
                from TEXT, \
                to TEXT, \
                email TEXT, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";

  // database reads and writes are non-blocking, so you need a callback function if you want
  // to do anything after insert. Parameters are sql query, params and the callback function
  this.app.storage.execDatabase(sql, {}, function() {});

}







//////////////////
// Confirmation //
//////////////////
Server.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  if (tx.transaction.to[0].returnAddress() != app.wallet.returnPublicKey()) { return; }

  // we provide access on zero-conf
  if (conf == 0) {

    // only a server should proceed
    if (app.BROWSERIFY == 1) { return; }

    // "this" is technically the array that calls us, so we have
    // to use a roundabout way of accessing the functions in our
    // server module in the onConfirmation function.
    //app.modules.returnModule("Server").addMessageToInbox(tx, app);
 
    if (tx.transaction.msg != null) {
      if (tx.transaction.msg.type == "access" && tx.returnAmountTo(app.wallet.returnPublicKey()) >= 5.0) {

	// send an email giving access
        to = tx.transaction.from[0].add;
        from = app.wallet.returnPublicKey();
        amount = 0.1;
        fee = 0.005;
        server_email_html = 'Access Granted \
<p></p> \
Our secret server is running at this address:\
<p></p> \
http://saito.tech:8080/ \
<p></p> \
You will need to login with the following: \
<p></p> \
user: secretuser \
<br /> \
pass: secretpass \
<p></p> \
Thanks for trying Saito! \
';

        newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);

        newtx.transaction.msg.module = "Email";
        newtx.transaction.msg.body   = server_email_html;
        newtx.transaction.msg.title  = "Server Access Granted!";
        newtx = app.wallet.signTransaction(newtx);

	// because we are a server, we add this to our mempool 
	// before we send it out. This prevents the transaction 
	// from getting rejected if sent back to us and never 
	// included in a block if we are the only one handling
	// transactions.
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
Server.prototype.webServer = function webServer(app, expressapp) {

  server_self = this;

  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/server/', function (req, res) {

    //rewrite indexHTML page
    fs.writeFileSync((__dirname + "/web/index.html"), server_self.returnIndexHTML(app), function(err) {
      if (err) {
        return console.log(err);
      }
    });
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/server/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });


}




Server.prototype.returnIndexHTML = function returnIndexHTML(app) {

return '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Online Demo</title> \
  <link rel="stylesheet" type="text/css" href="/server/style.css" /> \
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
      This is a private server. \
      <p></p> \
      <div id="donation_address" class="donation_address">'+app.wallet.returnPublicKey()+'</div> \
      <p></p> \
      For access, send 5 SAITO to this address using the "auth" module (keyword: "access"). \
    </div> \
\
</body> \
</html>';

}



Server.prototype.initializeHTML = function initializeHTML(app) {
}


// we want to listen on AUTH requests since we use those to monitor
// payments and access requests.
Server.prototype.shouldAffixCallbackToModule = function shouldAffixCallbackToModule(modname) {
  if (modname == this.name) { return 1; }
  if (modname == "Auth")    { return 1; }
  return 0;
}


