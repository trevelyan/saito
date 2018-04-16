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

  // 
  // DEMO
  //
  // if uncommented this starts up a separate nodejs server
  // that feeds out the private.html file and its stylesheet
  // on port 8080.
  //
  // for demo purposes, we simply redirect the users to a
  // subdirectory on our public server. this prevents the 
  // need for us to be running multiple nodejs server 
  // instances. this code is still provided for reference.
  // and as a demo of what is possible. note that usernames 
  // and passwords can also be dynamic and not just shared.
  /*
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
  */
}







//////////////////
// Confirmation //
//////////////////
Secret.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

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
http://saito.tech/secret/private.html \
<p></p> \
Use the following login credentials: \
<p></p> \
user: saito \
<br /> \
pass: noroomfortourists \
<p></p> \
';

        newtx = app.wallet.createUnsignedTransaction(to, amount, fee);
        newtx.transaction.msg.module = "Email";
        newtx.transaction.msg.data   = server_email_html;
        newtx.transaction.msg.title  = "Secret Server Access Granted!";
        newtx.transaction.msg.markdown = 0;
        newtx = app.wallet.signTransaction(newtx);
        app.blockchain.mempool.addTransaction(newtx);
        app.network.propagateTransaction(newtx);

      } else {

        // send an email refusing access
        to = tx.transaction.from[0].add;
        from = app.wallet.returnPublicKey();
        amount = 0.0;
        fee = 2.0;
        server_email_html = 'Your request for access has been denied as it did not contain a 5 SAITO payment AND/OR did not include the keyword "access" in its authorization request.';

        newtx = app.wallet.createUnsignedTransaction(to, amount, fee);
        newtx.transaction.msg.module = "Email";
        newtx.transaction.msg.data   = server_email_html;
        newtx.transaction.msg.title  = "Secret Server Access Failure";
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

  var secret_self = this;

  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/secret/', function (req, res) {
    //rewrite indexHTML page
    fs.writeFileSync((__dirname + "/web/index.html"), secret_self.returnIndexHTML(app), function(err) {
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
      Make any web-service pseudoanonymous and pay-for-access: \
      <p></p> \
      <div id="donation_address" class="donation_address">'+app.wallet.returnPublicKey()+'</div> \
      <p></p> \
      Send 5 SAITO to this address using the "Authorization" module (keyword: "access"). \
    </div> \
\
</body> \
</html>';

}




