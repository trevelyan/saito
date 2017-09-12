var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Archive(app) {

  if (!(this instanceof Archive)) { return new Archive(app); }

  Archive.super_.call(this);

  this.app             = app;

  this.name            = "Archive";
  this.browser_active  = 0;
  this.handlesEmail    = 1;

  this.host            = "localhost"; // hardcoded
  this.port            = "12100";     // hardcoded
  this.publickey       = "";          // hardcoded

  return this;

}
module.exports = Archive;
util.inherits(Archive, ModTemplate);


////////////////
// Initialize //
////////////////
Archive.prototype.initialize = function initialize() {
  this.publickey = this.app.wallet.returnPublicKey();
}


////////////////////
// Install Module //
////////////////////
Archive.prototype.installModule = function installModule() {

  if (this.app.BROWSER == 1) { return; }

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_archive (\
                id INTEGER, \
                publickey TEXT, \
                tx TEXT, \
                block_id INTEGER, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_archive_users (\
                id INTEGER, \
                publickey TEXT, \
                active INTEGER, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

}








////////////////////////
// Display Email Form //
////////////////////////
Archive.prototype.displayEmailForm = function displayEmailForm(app) {

  // auto-input correct address and payment amount
  $('#lightbox_compose_to_address').val(app.wallet.returnPublicKey());
  $('#lightbox_compose_payment').val(5);
  $('.lightbox_compose_address_area').hide();
  $('.lightbox_compose_module').hide();
  $('#send').hide();


  element_to_edit = $('#module_editable_space');
  element_to_edit_html = ' \
<div style="font-size:1.4em;padding:40px;"> \
Manage archiving servers: \
<p></p> \
<table id="archive_servers"> \
  <tr><th style="min-width:100px" align="left">Server</th><th align="left">Public Key</th><th align="left">Manage</th></tr> \
</table> \
</div> \
<style> \
.enable_online_archiving { font-size:0.9em;max-width: 290px; margin-top:20px;color: #ffffff; background-color: #18811c;text-align: center; padding-top: 2px; padding-bottom: 2px; padding-left: 5px; padding-right: 5px; line-height: 20px; font-weight: bold; border: 1px solid #0b420d; cursor: pointer;} \
.disable_online_archiving { font-size:0.9em;max-width: 290px; margin-top:20px;color: #ffffff; background-color: #d14836; text-align: center; padding-top: 2px; padding-bottom: 2px; padding-left: 5px; padding-right: 5px; line-height: 20px; font-weight: bold; border: 1px solid #b0281a; cursor: pointer;} </style> \
';
  element_to_edit.html(element_to_edit_html);

  // insert elements into select option
  myarchives = app.archives.returnArchives();
  for (mb = 0; mb < myarchives.length; mb++) {
console.log("SERVER: "+myarchives[mb]);
    xtracss = "";
    if (mb > 0) {  xtracss = "padding-top:5px"; }
    ah = '<td valign="bottom" style="'+xtracss+'">'+myarchives[mb].host+'</td><td valign="bottom" style="padding-right:20px">'+myarchives[mb].publickey+'</td>';
    if (myarchives[mb].active == "inactive") { ah += '<td class="enable_online_archiving" id="'+mb+'">ENABLE</td>'; }
    if (myarchives[mb].active == "active")   { ah += '<td class="disable_online_archiving" id="'+mb+'">DISABLE</td>'; }
    $('#archive_servers tr:last').after(ah);
  }


  $('.disable_online_archiving').off();
  $('.disable_online_archiving').on('click', function() {

    myarchivesIndex = $(this).attr('id');
    myarchives = app.archives.returnArchives();
    archive_server = myarchives[myarchivesIndex];

    to        = archive_server.publickey;
    from      = app.wallet.returnPublicKey();
    amount    = 0.0;
    fee       = 1.5;

    total_saito_needed = parseFloat(amount)+parseFloat(fee);
    if (total_saito_needed > 0.0) {
      if (app.wallet.returnBalance() < total_saito_needed) {
        alert("Your wallet does not have enough funds: "+ total_saito_needed + " SAITO needed");
        return;
      }
    }

    // send email using local publickey
    newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
    modsel = $('#lightbox_compose_module_select').val();
    newtx.transaction.msg.module = "Archive";
    newtx.transaction.msg.data   = {};
    newtx.transaction.msg.data.request = "disable archiving";
    newtx = app.wallet.signTransaction(newtx);

    app.network.propagateTransaction(newtx);

    archive_server.active = "inactive";
    app.archives.saveArchives();

    // hack but it works
    app.modules.returnModule("Email").showBrowserAlert("your message has been broadcast to the network");

    $.fancybox.close();

  });


  $('.enable_online_archiving').off();
  $('.enable_online_archiving').on('click', function() {

    myarchivesIndex = $(this).attr('id');
    myarchives = app.archives.returnArchives();
    archive_server = myarchives[myarchivesIndex];

    to        = archive_server.publickey;
    from      = app.wallet.returnPublicKey();
    amount    = 4.9;
    fee       = 0.1;

    total_saito_needed = parseFloat(amount)+parseFloat(fee);
    if (total_saito_needed > 0.0) {
      if (app.wallet.returnBalance() < total_saito_needed) {
        alert("Your wallet does not have enough funds: "+ total_saito_needed + " SAITO needed");
        return;
      }
    }

    // send email using local publickey
    newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
    modsel = $('#lightbox_compose_module_select').val();
    newtx.transaction.msg.module = "Archive";
    newtx.transaction.msg.data   = {};
    newtx.transaction.msg.data.request = "enable archiving";
    newtx = app.wallet.signTransaction(newtx);

    app.network.propagateTransaction(newtx);

    archive_server.active = "active";
    app.archives.saveArchives();

    // hack but it works
    app.modules.returnModule("Email").showBrowserAlert("your message has been broadcast to the network");

    $.fancybox.close();

  });


}









/////////////////////////
// Handle Web Requests //
/////////////////////////
Archive.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/archive/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/archive/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}





//////////////////////////
// Handle Peer Requests //
//////////////////////////
Archive.prototype.handlePeerRequest = function handlePeerRequest(app, message, peer, mycallback) {


    //////////////////////////////
    // archive loading (server) //
    //////////////////////////////
    if (message.request == "archive load request") {
      starting_at       = message.data.starting_at;
      number_of_entries = message.data.number;
      publickey = message.data.publickey;
      sql    = "SELECT * FROM mod_archive WHERE publickey = $publickey LIMIT $number_of_entries OFFSET $starting_at";
      params = { $publickey : publickey, $number_of_entries : number_of_entries, $starting_at : starting_at } 
      app.storage.queryDatabaseArray(sql, params, function(err, rows) {
        if (rows != null) {
	  for (mat = 0; mat < rows.length; mat++) {
	    message                 = {};
	    message.request         = "archive load";
	    message.data            = {};
	    message.data.tx         = rows[mat].tx;
	    message.data.block_id   = rows[mat].block_id;
	    message.data.unixtime   = rows[mat].unixtime;
            peer.sendRequest(message.request, message.data);
          }
        }
      });
    }




    ////////////////////////////////
    // archive delete transaction //
    ////////////////////////////////
    if (message.request == "archive delete request") {
      txid      = message.data.txid;
      txts      = message.data.txts;
      publickey = message.data.publickey;
      sql    = "SELECT * FROM mod_archive WHERE publickey = $publickey AND unixtime = $unixtime";
      params = { $publickey : publickey, $unixtime : txts };
      app.storage.queryDatabaseArray(sql, params, function(err, rows) {
        if (rows != null) {
	  for (mat = 0; mat < rows.length; mat++) {
	    tmptx = new saito.transaction(rows[mat].tx);
	    if (tmptx.transaction.id == txid) {
              sql = "DELETE FROM mod_archive WHERE publickey = $publickey AND unixtime = $unixtime AND tx = $ourtx";
      	      params = { $publickey : publickey, $unixtime : txts, $ourtx : rows[mat].tx};
      	      app.storage.execDatabase(sql, params, function() {});
	    }
          }
        }
      });
    }





    ////////////////////////////////
    // archive reset (delete all) //
    ////////////////////////////////
    if (message.request == "archive reset request") {
      publickey = message.data.publickey;
      sql = "DELETE FROM mod_archive WHERE publickey = $publickey";
      params = { $publickey : publickey };
      app.storage.execDatabase(sql, params, function() {});
    }





    //////////////////////////////
    // archive loading (client) //
    //////////////////////////////

    if (message.request == "archive load") {

      tx       = message.data.tx;
      block_id = message.data.block_id;
      unixtime = message.data.unixtime;

      newtx = new saito.transaction(tx);
console.log("SENDING TO ARCHIVE LOAD");
      this.app.modules.loadFromArchives(newtx);

    }







    /////////////
    // archive //
    /////////////
    if (message.request == "archive") {

      // requests need to be submitted with some sort of signed proof of messaging
      //
      // obvious bug - anyone can submit content to be archived just by
      // providing a private key
      //
      // FIX
      //

      // check we are authorized to archive data
      sql = "SELECT count(*) AS count FROM mod_archive_users WHERE publickey = $publickey AND active = 1";
      params = { $publickey : message.data.publickey };
      peer.app.storage.queryBlockchain(sql, params, function (err, row) {
        if (row != null) {
          if (row.count > 0) {
            sql = "INSERT OR IGNORE INTO mod_archive (publickey, tx, block_id, unixtime) VALUES ($publickey, $tx, $block_id, $unixtime)";
            app.storage.db.run(sql, {
              $publickey: message.data.publickey,
              $tx: message.data.tx,
              $block_id: message.data.block_id,
              $unixtime: message.data.unixtime
            });
          }
        }
      });
    }


}








//////////////////
// Confirmation //
//////////////////
Archive.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  if (tx.transaction.to[0].add != app.wallet.returnPublicKey()) { return; }

  if (conf == 0) {

console.log("HERE: ");
console.log(tx.transaction.msg);


    if (tx.transaction.msg.data.request == "enable archiving") {
      pkuser = tx.transaction.from[0].add;
      sql = "INSERT OR IGNORE INTO mod_archive_users (publickey, active) VALUES ($publickey, $active)";
      app.storage.db.run(sql, {
        $publickey : pkuser,
        $active : 1
      });

      to = pkuser;
      amount = 0.0;
      fee = 2.0;

      server_email_html = 'We have enabled online archiving for your account.';

      newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
      newtx.transaction.msg.module = "Email";
      newtx.transaction.msg.data   = server_email_html;
      newtx.transaction.msg.title  = "Online Archiving Enabled";
      newtx = app.wallet.signTransaction(newtx);

      app.blockchain.mempool.addTransaction(newtx);
      app.network.propagateTransaction(newtx);
    }


    if (tx.transaction.msg.data.request == "disable archiving") {
      pkuser = tx.transaction.from[0].add;
      sql = "UPDATE mod_archive_users SET active = 0 WHERE publickey = $publickey";
      app.storage.db.run(sql, {
        $publickey : pkuser
      });

      to = pkuser;
      amount = 0.0;
      fee = 0.005;

      server_email_html = 'We have disabled online archiving for your account.';

      newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
      newtx.transaction.msg.module = "Email";
      newtx.transaction.msg.data   = server_email_html;
      newtx.transaction.msg.title  = "Online Archiving Disabled";
      newtx = app.wallet.signTransaction(newtx);

      app.blockchain.mempool.addTransaction(newtx);
      app.network.propagateTransaction(newtx);
    }

  }

}



