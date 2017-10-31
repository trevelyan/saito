var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Auth(app) {

  if (!(this instanceof Auth)) { return new Auth(app); }

  Auth.super_.call(this);

  this.app             = app;

  this.name            = "Authorization";
  this.browser_active  = 0;
  this.handlesEmail    = 1;
  this.emailAppName    = "Authorization";

  this.email_view_txid = 0;

  return this;

}
module.exports = Auth;
util.inherits(Auth, ModTemplate);



////////////////////
// Install Module //
////////////////////
Auth.prototype.installModule = function installModule() {

  if (this.app.BROWSER == 1) { return; }

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_auth (\
                id INTEGER, \
                sender TEXT, \
                receiver TEXT, \
                keyword TEXT, \
                key TEXT, \
                value TEXT, \
                unixtime INTEGER, \
		UNIQUE (receiver, sender, keyword, key, value), \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

}




/////////////////////
// Email Functions //
/////////////////////
Auth.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');
  element_to_edit.html('<div style="min-height:100px;padding:40px;font-size:1.2em;">If your application requires one, you can provide an extra keyword and/or key/value pair.<p></p><table><tr><td style="width:100px"><b>keyword:</b></td><td><input type="text" name="msgtype" id="msgtype" value="" style="width:100px;font-size:1.2em;padding:2px;" /></td></tr></table><p></p><div style="margin-top:20px;font-weight:normal;cursor:pointer;margin-bottom:25px;" onclick="$(\'.advanced_keyvalue_entry\').toggle();">Click here for advanced options...</div><div class="advanced_keyvalue_entry" style="display:none"><table><tr><td style="width:100px"><b>key:</b></td><td><input type="text" name="msgkey" id="msgkey" value="" style="width:100px;font-size:1.2em;padding:2px;" /></td></tr><tr><td style="width:100px"><b>value:</b></td><td><input type="text" name="msgvalue" id="msgvalue" value="" style="width:100px;font-size:1.2em;padding:2px;" /></td></tr></table></div></div>');

}
Auth.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  link_id    = "authorize_link_"+this.email_view_txid;

  // always set the message.module to the name of the app
  tx.transaction.msg.module  = this.name;
  tx.transaction.msg.request = "request";
  tx.transaction.msg.to      = tx.transaction.to[0].add;
  tx.transaction.msg.from    = tx.transaction.from[0].add;
  tx.transaction.msg.type    = $('#msgtype').val();
  tx.transaction.msg.key     = $('#msgkey').val();
  tx.transaction.msg.value   = $('#msgvalue').val();
  tx.transaction.msg.title   = "Authorization Requested";

  if (tx.transaction.msg.type != "") {
    tx.transaction.msg.title   = "Authorization Requested (keyword: "+tx.transaction.msg.type+")";
    email_html = 'You have received an authentication request (keyword: '+tx.transaction.msg.type+') from: <p></p>'+tx.transaction.from[0].add+'<p></p>To authorize this account, <div class="authorize_link" id="'+link_id+'" style="display:inline;text-decoration:underline;cursor:pointer">click here</div>.';
  } else {
    email_html = 'You have received an authentication request from: <p></p>'+tx.transaction.from[0].add+'<p></p>To authorize this account, <div class="authorize_link" id="'+link_id+'" style="display:inline;text-decoration:underline;cursor:pointer">click here</div>.';
  }
  if (tx.transaction.msg.key != "" || tx.transaction.msg.value != "") {
    email_html += '<p></p>This request included the key/value information: '+tx.transaction.msg.key+'/'+tx.transaction.msg.value;
  }
  tx.transaction.msg.data    = email_html;

  return tx;

}
Auth.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  if (app.BROWSER == 1) {
    this.email_view_txid = message_id.substring(8);
    message_text_selector = "#" + message_id + " > .data";
    authbody = $(message_text_selector).html();

    $('#lightbox_message_text').html(authbody);

    // update authorize link ID
    message_text_selector = ".lightbox_message_text > .authorize_link";
    new_auth_link = "authorize_link_"+this.email_view_txid;
    $(message_text_selector).attr('id', new_auth_link);
  }

}









/////////////////////////
// Handle Web Requests //
/////////////////////////
Auth.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/auth/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/auth/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}










//////////////////
// Confirmation //
//////////////////
Auth.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  if (conf == 0) {

    var sender           = tx.transaction.from[0].add;
    var receiver         = tx.transaction.to[0].add;
    var msgtype          = tx.transaction.msg.type;
    var msgkey           = tx.transaction.msg.key;
    var msgvalue         = tx.transaction.msg.value;
    var msgrequest       = tx.transaction.msg.request;  // "request"
		
    /////////////////////////
    // requests made to us //
    /////////////////////////
    if (receiver == app.wallet.returnPublicKey()) {

      // if the request is an authoriztation
      if (tx.transaction.msg.request == "authorize") {

        msg        = {};
        msg.id     = tx.transaction.id;
        msg.from   = sender;
        msg.time   = tx.transaction.ts;
        msg.type   = tx.transaction.msg.type;
        msg.key    = tx.transaction.msg.key;
        msg.value  = tx.transaction.msg.value;
        msg.module = "Auth";
        msg.title  = tx.transaction.msg.title;
        msg.data   = tx.transaction.msg.data;;

        app.modules.returnModule("Email").attachMessage(msg, app);
        app.archives.saveMessage(tx);

      } else {


        msg        = {};
        msg.id     = tx.transaction.id;
        msg.from   = sender;
        msg.time   = tx.transaction.ts;
        msg.type   = tx.transaction.msg.type;
        msg.key    = tx.transaction.msg.key;
        msg.value  = tx.transaction.msg.value;
        msg.module = "Auth";
        msg.title  = tx.transaction.msg.title;
        msg.data   = tx.transaction.msg.data;;

        app.modules.returnModule("Email").attachMessage(msg, app);
        app.archives.saveMessage(tx);

      }


    /////////////////////////////////
    // listening to other requests //
    /////////////////////////////////
    } else {

      sql = "SELECT count(*) AS count FROM mod_auth WHERE sender = $sender";
      app.storage.queryDatabase(sql, {$sender:sender}, function(err, row) {
        if (row.count == 1) {
          sql = "INSERT OR IGNORE INTO mod_auth (sender, receiver, keyword, key, value) VALUES ($sender, $receiver, $msgtype, $msgkey, $msgvalue)";
          app.storage.execDatabase(
            sql, {
              $sender   : sender,
              $receiver : receiver,
              $msgtype  : msgtype,
              $msgkey   : msgkey,
              $msgvalue : msgvalue,
            },
            function() {}
          );
        }
      });
    }

  }
}






Auth.prototype.attachEmailEvents = function attachEmailEvents(app) {

  if (app.BROWSER == 1) {

    // fancybox does not want us to attach events by #id so we
    // have to handle it by class. This is a bug in their software
    $('.authorize_link').off();
    $('.authorize_link').on('click', function() {

      txid = $(this).attr('id');
      txid = txid.substring(15);

      thistx = app.archives.returnTransactionById(txid);
      if (thistx == null) { return; }

      remote_address = thistx.transaction.from[0].add;

      email_html = 'You have authorized a request from: <p></p>'+app.modules.returnModule("Email").formatAuthor(remote_address, app);

      utx = app.wallet.createUnsignedTransactionWithFee(remote_address, 0.0, 2.0);
      if (utx == null) { return; }
      utx.transaction.msg.module  = "Auth";
      utx.transaction.msg.request = "authorize";
      utx.transaction.msg.tx_id   = txid;		// reference id for parent tx
      utx.transaction.msg.type    = thistx.transaction.msg.type;
      utx.transaction.msg.key     = thistx.transaction.msg.key;
      utx.transaction.msg.value   = thistx.transaction.msg.value;
      utx.transaction.msg.title   = "Authorization Granted";
      utx.transaction.msg.data    = email_html;

      utx = app.wallet.signTransaction(utx);
      app.blockchain.mempool.addTransaction(utx);
      app.network.propagateTransaction(utx);

      $.fancybox.close();

      app.modules.returnModule("Email").showBrowserAlert("your authorization has been broadcast to the network");

    });
  }
}






