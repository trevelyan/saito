//
// Saito is a key-value registry that is stored on the blockchain.
// It is used to store and publish lists linking email addresses
// to public keys.
//
// The idea should be generalizable to other forms of security
// keys and certificates such as DNS records, SSH certificates,
// etc.
//
// Our convention for usage is [identifier]@module
//
// This registry thus concerns itself with:
//
// [name]@saito.tech
//
// we use our domain name as the identifier so that we can act
// as an email hub for regular mail.
//
var saito = require('../../saito');
var ModTemplate = require('../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Saito(app) {

  if (!(this instanceof Saito)) { return new Saito(app); }
  Saito.super_.call(this);

  this.app                    = app;
  this.name                   = "Saito";
  this.supportsEmailInterface = 1;   // we have an email module
				     // that is used to register
				     // domain names

  // we add these for key-value pair
  this.domain                 = "saito.tech";
  this.publickey              = "";

  return this;

}
module.exports = Saito;
util.inherits(Saito, ModTemplate);






////////////////////
// Install Module //
////////////////////
Saito.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_saito_addresses (\
                id INTEGER, \
                identifier TEXT, \
                publickey TEXT, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";

  // database reads and writes are non-blocking, so you need a callback function if you want
  // to do anything after insert. Parameters are sql query, params and the callback function
  this.app.storage.execDatabase(sql, {}, function() {});

}









///////////////////////////////////////
// Handles Responses to DNS Requests //
///////////////////////////////////////
Saito.prototype.handleDomainRequest = function handleDomainRequest(app, message, peer, mycallback) {

console.log("HANDLING DOMAIN REQUEST: ");

  identifier = message.data.identifier;

  sql = "SELECT * FROM mod_saito_addresses WHERE identifier = $identifier";
  params = { $identifier : identifier };
  app.storage.queryBlockchain(sql, params, function (row) {
    if (row != null) {
      if (row.publickey != null) {
        mycallback(row.publickey);
      }
    } else {
      mycallback("");
    }
  });

}







///////////////////////
// Initialize Module //
///////////////////////
Saito.prototype.initialize = function initialize(app) {

  // if we are a browser client, we don't want to tell our
  // browser we can handle industrial DNS requests even if
  // the module is installed.
  if (app.BROWSERIFY == 1) { return; }



  // inform the DNS module that we are able to assist with its 
  // inquiries. :)
  //
  // our public key needs to be hard-coded into this module. Other
  // servers can also track the Saito domain -- they just need to 
  // swap in their own wallet.
  this.domain                 = "saito.tech";
  this.publickey              = this.app.wallet.returnPublicKey();

  app.dns.addDomain(this.domain, this.publickey);


console.log("what does our doman server look like?");
console.log(app.dns.dns.domains);


}







//////////////////
// Confirmation //
//////////////////
Saito.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  // registration happens on zero-conf
  if (conf == 0) {

    // only a server should proceed
    if (app.BROWSERIFY == 1) {
      return;
    }


    if (tx.transaction.msg != null) {

      // sanity 
      if (tx.transaction.msg.module != "Saito") { return; }




      sql = "SELECT count(*) AS count FROM mod_saito_addresses WHERE identifier = $identifier";
      params = { $identifier : tx.transaction.msg.saito_identifier }
      app.storage.queryDatabase(sql, params, function(row) {

        if (row != null) {

          if (row.count == 0) {

            sql = "INSERT OR IGNORE INTO mod_saito_addresses (identifier, publickey, unixtime) VALUES ($identifier, $publickey, $unixtime)";
            console.log(sql);

	    full_identifier = tx.transaction.msg.saito_identifier + "@" + app.modules.returnModule("Saito").domain;

            params = { $identifier : full_identifier, $publickey : tx.transaction.from[0].add, $unixtime : tx.transaction.ts };
            console.log(params);

            app.storage.execDatabase(sql, params, function() {

              // email address is registered, send confirmation
              to = tx.transaction.from[0].add;
              from = app.wallet.returnPublicKey();
              amount = 0.0;
              fee = 0.005;

              server_email_html = 'You can now receive emails from anyone running the default Saito client by giving them this identifier:<p></p>'+tx.transaction.msg.saito_identifier+'@saito.tech<p></p>Be sure to update your account settings to add this identifier to your account.';

              newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
              newtx.transaction.msg.module = "Email";
              newtx.transaction.msg.body   = server_email_html;
              newtx.transaction.msg.title  = "Address Registration Success!";
              newtx = app.wallet.signTransaction(newtx);

              // because we are a server, we add this to our mempool
              // before we send it out. This prevents the transaction
              // from getting rejected if sent back to us and never
              // included in a block if we are the only one handling
              // transactions.
              app.blockchain.mempool.addTransaction(newtx);
              app.network.propagateTransaction(newtx);
            });

          } else {

            // identifier already registered
            to = tx.transaction.from[0].add;
            from = app.wallet.returnPublicKey();
            amount = 4.9;
            fee = 0.005;

            server_email_html = tx.transaction.msg.saito_identifier + ' is already registered';

            newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
            newtx.transaction.msg.module = "Email";
            newtx.transaction.msg.body   = server_email_html;
            newtx.transaction.msg.title  = "Address Registration Failure!";
            newtx = app.wallet.signTransaction(newtx);

            // servers add to mempool before sending. this avoids loopback failure
            app.blockchain.mempool.addTransaction(newtx);
            app.network.propagateTransaction(newtx);

	  }
        }  // if row is null
      });  //
    } // if tx msg is null
  } // if zero conf

}






/////////////////////////////
// Display User Input Form //
/////////////////////////////
Saito.prototype.displayUserInputForm = function displayUserInputForm(app) {

  element_to_edit = $('#module_editable_space');
  element_to_edit_html = '<div id="saito_instructions" class="saito_instructions">To register an address on the Saito network, provide the identifier you wish others to be able to use to contact you. Your transaction should include a 5 SAITO payment. <p></p><input type="text" class="saito_identifier" id="saito_identifier" value="" /><div class="saito_domain">@saito.tech</div><p style="clear:both;margin-top:0px;"> </p>Examples: david@saito.tech, yourname@saito.tech, etc. </div>';
  element_to_edit_css  = '<style>.saito_instructions{width:80%;height:300px;padding:40px;font-size:1.2em;} .saito_identifier{margin-top:15px;width:200px;padding:5px;font-size:1.2em;float:left;} .saito_domain{ margin-left:5px;font-size:1.3em;font-weight:bold;padding-top:20px;padding-bottom:20px;float:left; } </style>';
  element_to_edit.html(element_to_edit_html + element_to_edit_css);

  // auto-input correct address and payment amount
  $('#lightbox_compose_to_address').val(app.wallet.returnPublicKey());
  $('#lightbox_compose_payment').val(5);

}







/////////////////////
// Display Message //
/////////////////////
Saito.prototype.displayMessage = function displayMessage(message_id, app) {

  if (app.BROWSERIFY == 1) {
    // json contains email content
    message_text_selector = "#" + message_id + " > .json";
    jsonbody = $(message_text_selector).html();
    $('#lightbox_message_text').html(jsonbody);
    $('#lightbox_compose_to_address').val(app.wallet.returnPublicKey());
    $('#lightbox_compose_payment').val(5);

  }

}





////////////////////////
// Format Transaction //
////////////////////////
Saito.prototype.formatTransaction = function formatTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module = this.name;
  tx.transaction.msg.saito_identifier  = $('#saito_identifier').val();
  return tx;

}






//////////////////////////
// Add Message To Inbox //
//////////////////////////
Saito.prototype.addMessageToInbox = function addMessageToInbox(tx, app) {

    // fetch data from app
    msg = {};
    msg.id     = tx.transaction.id;
    msg.time   = formatDate(tx.transaction.ts);
    msg.from   = tx.transaction.from[0].returnAddress();
    msg.module = tx.transaction.msg.module;
    msg.title  = "Saito Registry Confirmation";
    msg.json   = tx.transaction.saito_identifier;

    this.attachMessage(msg, app);

}





/////////////////////////
// Handle Web Requests //
/////////////////////////
Saito.prototype.webServer = function webServer(app, expressapp) {


  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/saito/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/saito/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });


}







///////////////////
// Attach Events //
///////////////////
//
// webpage has no interactivity
//
Saito.prototype.attachEvents = function attachEvents(app) {
}
Saito.prototype.initializeHTML = function initializeHTML(app) {
}








