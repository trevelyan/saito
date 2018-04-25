//
// This module monitors the blockchain and our
// unspent transaction inputs. It creates fake
// transactions to speed up block production 
// for testing purposes.`
//
var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var crypto = require('crypto');



//////////////////
// CONSTRUCTOR  //
//////////////////
function AppStore(app) {

  if (!(this instanceof AppStore)) { return new AppStore(app); }

  AppStore.super_.call(this);

  this.app             = app;
  this.name            = "AppStore";
  this.handlesEmail    = 1;
  this.emailAppName    = "Publish to AppStore";
  return this;

}
module.exports = AppStore;
util.inherits(AppStore, ModTemplate);




////////////////////
// Install Module //
////////////////////
AppStore.prototype.installModule = function installModule() {

  var sql = 'CREATE TABLE IF NOT EXISTS mod_appstore_apps (\
                id INTEGER, \
                pubkey_pub TEXT, \
                pubkey_app TEXT, \
                sig_app TEXT, \
                tx TEXT, \
                UNIQUE (pubkey_app), \
                PRIMARY KEY(id ASC) \
  )';
  this.app.storage.execDatabase(sql, {}, function() {});

  var sql2 = 'CREATE TABLE IF NOT EXISTS mod_appstore_sigs (\
                id INTEGER, \
                review TEXT, \
                publickey_reviewer TEXT, \
                signature_review TEXT, \
                tx TEXT, \
                PRIMARY KEY(id ASC) \
  )';
  this.app.storage.execDatabase(sql2, {}, function() {});

}




/////////////////////////
// Handle Web Requests //
/////////////////////////
AppStore.prototype.webServer = function webServer(app, expressapp) {

  var advert_self = this;

  expressapp.get('/appstore', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/appstore/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.get('/advert/cache/:archive', function (req, res) {
    var imgf = '/web/cache/'+req.params.archivefile;
    if (imgf.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + imgf);
    return;
  });
}




/////////////////////
// Email Functions //
/////////////////////
AppStore.prototype.displayEmailForm = function displayEmailForm(app) {
  element_to_edit = $('#module_editable_space');
  element_to_edit.html('<div class="module_instructions">Upload a Saito module.</div>');
}
AppStore.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module                = this.name;
  tx.transaction.msg.request               = "module upload";
  tx.transaction.msg.archive               = "module upload";
  tx.transaction.msg.pubkey_app = "AAA";
  tx.transaction.msg.sig_app = "AAA";

  return tx;

}





//////////////////
// Confirmation //
//////////////////
AppStore.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  if (app.BROWSER == 1) { return; }

  // first confirmation
  if (conf == 0) {

    var myappstore = app.modules.returnModule("AppStore");

    var txmsg = tx.returnMessage();

    // app submission
    if (txmsg.request == "module upload") {

      var archive = txmsg.archive;  
      var pubkey_pub = tx.transaction.from[0].add;
      var pubkey_app = txmsg.pubkey_app;
      var sig_app = txmsg.sig_app;

      // insert application
      var sql    = "INSERT INTO mod_appstore_apps (pubkey_pub, pubkey_app, sig_app, tx) VALUES ($pka, $pkp, $sa, $tx)";
      var params = {
        $pka : pubkey_app,
        $pkp : pubkey_pub,
        $sa  : sig_app,
        $tx  : JSON.stringify(tx)
      }
console.log(sql);
console.log(params);
      app.storage.db.run(sql, params, function(err) {
console.log("SUCESSFUL INSERTION INTO DATABASE");
      });

    }





    // app submission
    if (txmsg.request == "module review") {

      var archive = txmsg.archive;  
      var pubkey_pub = tx.transaction.from[0].add;
      var pubkey_app = txmsg.pubkey_app;
      var sig_app = txmsg.sig_app;

      // insert application
      var sql    = "INSERT INTO mod_appstore_apps (pubkey_pub, pubkey_app, sig_app, tx) VALUES ($pka, $pkp, $sa, $tx)";

    }



  }
}











