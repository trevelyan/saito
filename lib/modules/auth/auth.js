var saito = require('../../saito');
var ModTemplate = require('../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Auth(app) {

  if (!(this instanceof Auth)) { return new Auth(app); }
  Auth.super_.call(this);

  this.app             = app;
  this.name            = "Auth";

  return this;

}
module.exports = Auth;
util.inherits(Auth, ModTemplate);










////////////////////
// Install Module //
////////////////////
Auth.prototype.installModule = function installModule() {

 sql = "\
        CREATE TABLE IF NOT EXISTS mod_auths (\
                id INTEGER, \
                sender TEXT, \
                receiver TEXT, \
                type TEXT, \
                key TEXT, \
                value TEXT, \
                unixtime INTEGER, \
                UNIQUE (sender, receiver, type, key, value), \
                PRIMARY KEY(id ASC) \
        )";


  // database reads and writes are non-blocking, so you need a callback function if you want
  // to do anything after insert. Parameters are sql query, params and the callback function
  this.app.storage.execDatabase(sql, {}, function() { });

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
    var msgrequest       = tx.transaction.msg.request;  // "request" or "authorize"



    // requests made to us
    if (receiver == app.wallet.returnPublicKey()) {

      // fetch data from app
      msg = {};
      msg.id     = tx.transaction.id;
      msg.time   = formatDate(tx.transaction.ts);
      msg.from   = tx.transaction.from[0].add;
      msg.module = "Auth";
      link_id    = "authorize_link_"+msg.id;


      if (tx.transaction.msg.request == "authorize") {
        email_html = 'Confirmation: you have authorized an authentication request from: <p></p>'+msg.from;
        msg.title  = "Authorization Granted";
        msg.json   = email_html;
      } else {
        email_html = 'You have received an authentication request from: <p></p>'+msg.from+'<p></p>To authorize this account, <div class="authorize_link" id="'+link_id+'" style="text-decoration:underline">click here</div>.';
        msg.title  = "Authorization Requested";
        msg.json   = email_html;
      }

      app.browser.attachMessage(msg);
      app.storage.saveMessage(tx);

    } else {

      // authorize users invited by users we have authorized
      sql = "SELECT count(*) AS count FROM mod_auths WHERE sender = $sender";
      app.storage.queryDatabase(sql, {$sender:sender}, function(row) {
        if (row.count == 1) {

          ///////////////////////////
	  // record authorizations //
          ///////////////////////////
          sql = "INSERT OR IGNORE INTO mod_auths (sender, receiver, type, key, value) VALUES ($sender, $receiver, $msgtype, $msgkey, $msgvalue)";
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




/////////////////////////////
// Display User Input Form //
/////////////////////////////
Auth.prototype.displayUserInputForm = function displayUserInputForm() {

  element_to_edit = $('#module_editable_space');
  element_to_edit.html('<div style="min-height:100px;padding-bottom:40px;font-size:1.2em;padding-top:40px;">\
Authorization messages are typically used by third-party services, such as decentralized social networks. If the service you are attempting to use requests it, you can optionally provide a keyword as part of your message, along with (if needed) a key/value pair. Services typically use the keyword to filter relevant messages, and the key/value services to accept your input. \
 \
<p></p> \
 \
<table><tr><td style="width:100px"><b>keyword:</b></td><td><input type="text" name="msgtype" id="msgtype" value="" style="width:100px;font-size:1.2em;padding:2px;" /></td></tr></table> \
 \
<p></p> \
 \
<table> \
<tr><td style="width:100px"><b>key:</b></td><td><input type="text" name="msgkey" id="msgkey" value="" style="width:100px;font-size:1.2em;padding:2px;" /></td></tr> \
<tr><td style="width:100px"><b>value:</b></td><td><input type="text" name="msgvalue" id="msgvalue" value="" style="width:100px;font-size:1.2em;padding:2px;" /></td></tr> \
</table> \
</div>');

}







/////////////////////
// Display Message //
/////////////////////
Auth.prototype.displayMessage = function displayMessage(message_id, app) {

  if (app.BROWSERIFY == 1) {

    // json is simply email content in basic email module
    message_text_selector = "#" + message_id + " > .json";
    authbody = $(message_text_selector).html();
    $('#lightbox_message_text').html(authbody);

  }

}





/////////////////////////////////
// Attach Events to HTML Email //
/////////////////////////////////
Auth.prototype.attachMessageEvents = function attachMessageEvents(message_id, app) {

  if (app.BROWSERIFY == 1) {

    // fancybox does not want us to attach events by #id so we 
    // have to handle it by class. This is a bug in their software
    $('.authorize_link').on('click', function() {

      txid = $(this).attr('id');      
      txid = txid.substring(15);

      message_from_selector = "#message_"+txid+" > .from";
      remote_address = $(message_from_selector).text();

      // browsers store messages in browser cache
      for (mv = app.options.messages.length-1; mv >= 0; mv--) {

        tx = new saito.transaction(app.options.messages[mv]);

        if (tx.transaction.id == txid) {
          utx = app.wallet.createUnsignedTransactionWithFee(tx.transaction.from[0].add, 0.001, 0.001);
          utx.transaction.msg.module  = "Auth";
          utx.transaction.msg.request = "authorize";
          utx.transaction.msg.type    = "";
          utx.transaction.msg.key     = "";
          utx.transaction.msg.value   = "";
          utx = app.wallet.signTransaction(utx);
	  app.blockchain.mempool.addTransaction(utx);
          app.network.propagateTransaction(utx);

	  $.fancybox.close();

        }

      }
    });
  }
}







////////////////////////
// Format Transaction //
////////////////////////
Auth.prototype.formatTransaction = function formatTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module  = this.name;
  tx.transaction.msg.request = "request";
  tx.transaction.msg.type    = $('#msgtype').val();
  tx.transaction.msg.key     = $('#msgkey').val();
  tx.transaction.msg.value   = $('#msgvalue').val();

  return tx;

}






//////////////////////////
// Add Message To Inbox //
//////////////////////////
Auth.prototype.addMessageToInbox = function addMessageToInbox(tx, app) {

    // fetch data from app
    msg = {};
    msg.id    = tx.transaction.id;
    msg.time  = formatDate(tx.transaction.ts);
    msg.from  = tx.transaction.from[0].returnAddress();
    msg.module = tx.transaction.msg.module;
    msg.title = "Authentication Request";

    email_html = ' \
You have received an authentication request from: <p></p>'+msg.from+' \
\
<p></p>\
\
To authorize this account, <div onclick="function() { \
\
alert("authorizing account");\
\
}" style="text-decoration:underline">click here</a>.';

    msg.json = email_html;

    app.browser.attachMessage(msg);

}






//////////////////////
// Custom Functions //
//////////////////////



