var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var fs          = require('fs');
var request = require("request");


//////////////////
// CONSTRUCTOR  //
//////////////////
function Registry(app) {

  if (!(this instanceof Registry)) { return new Registry(app); }

  Registry.super_.call(this);

  this.app             = app;

  this.name            = "Registry";
  this.browser_active  = 0;
  this.handlesEmail    = 1;
  this.handlesDNS      = 1;
  this.emailAppName    = "Register Address";

  this.domain          = "satoshi";
  this.host            = "localhost"; // hardcoded
  this.port            = "12100";     // hardcoded
  this.publickey       = "034c7064c8a3c23e62d58a454f75a2a6828a2b069d0b73f83d9bcb65bb80b73a31";

  return this;

}
module.exports = Registry;
util.inherits(Registry, ModTemplate);




////////////////////
// Install Module //
////////////////////
Registry.prototype.installModule = function installModule() {

  var registry_self = this;

  if (registry_self.app.BROWSER == 1 || registry_self.app.SPVMODE == 1) { return; }

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_registry_addresses (\
                id INTEGER, \
                identifier TEXT, \
                publickey TEXT, \
                unixtime INTEGER, \
                signature TEXT, \
		UNIQUE (identifier), \
                PRIMARY KEY(id ASC) \
        )";

  this.app.storage.execDatabase(sql, {}, function() {

    // if we are not the main server but we are running
    // the registry module, we want to be able to track
    // DNS requests, which means running our own copy
    // of the database.
    if (registry_self.app.wallet.returnPublicKey() != registry_self.publickey) {

      // fetch the latest data from our server 
      var url = "http://saito.tech:12100/registry/addresses.txt";
      try {
        request.get(url, (error, response, body) => {

	  if (body != null) {
            var lines = body.split("\n");

            for (var m = 0; m < lines.length; m++) {
	      if (lines[m] != null && lines[m].indexOf("undefined") != 0) {

	        var write_to_file = lines[m] + "\n";
                fs.appendFileSync((__dirname + "/web/addresses.txt"), write_to_file, function(err) {
                  if (err) {
                    return console.log(err);
                  }
                });

	        registry_self.app.storage.execDatabase(lines[m], {}, function(err) {
	        });
  	      }
            }
          }
        });
      } catch (err) {}

    }

  });

}





/////////////////////////
// Handle Web Requests //
/////////////////////////
Registry.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/registry/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/registry/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

  // sql
  expressapp.get('/registry/addresses.txt', function (req, res) {
    res.sendFile(__dirname + '/web/addresses.txt');
    return;
  });

}






////////////////////////////////
// Email Client Interactivity //
////////////////////////////////
Registry.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');

  element_to_edit_html = '<div id="module_instructions" class="module_instructions">Register a human-readable email address:<p></p><input type="text" class="module_textinput" id="module_textinput" value="" /><div class="module_textinput_details">@'+this.domain+'</div><p style="clear:both;margin-top:0px;"> </p>examples: david@'+this.domain+', yourname@'+this.domain+', etc. <p></p><div id="module_textinput_button" class="module_textinput_button" style="margin-left:0px;margin-right:0px;">register</div></div>';
  element_to_edit.html(element_to_edit_html);

  $('#module_textinput_button').off();
  $('#module_textinput_button').on('click', function() {
    var identifier_to_check = $('module_textinput').val();
    var regex=/^[0-9A-Za-z]+$/;
    if (regex.test(identifier_to_check)) {
      $('#send').click();
    } else {
      alert("Only Alphanumeric Characters Permitted");
    }
  });


  // auto-input correct address and payment amount
  $('#lightbox_compose_to_address').val(this.publickey);
  $('#lightbox_compose_payment').val(3);
  $('#lightbox_compose_fee').val(2);
  $('.lightbox_compose_address_area').hide();
  $('.lightbox_compose_module').hide();
  $('#module_textinput').focus();

}
/////////////////////
// Display Message //
/////////////////////
Registry.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  if (app.BROWSER == 1) {

    message_text_selector = "#" + message_id + " > .data";
    $('#lightbox_message_text').html( $(message_text_selector).html() );
    $('#lightbox_compose_to_address').val(app.wallet.returnPublicKey());
    $('#lightbox_compose_payment').val(3);
    $('#lightbox_compose_fee').val(2);

  }

}
////////////////////////
// Format Transaction //
////////////////////////
Registry.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  // always set the message.module to the name of the app
  tx.transaction.msg.module = this.name;
  tx.transaction.msg.requested_identifier  = $('#module_textinput').val().toLowerCase();
  return tx;

}









//////////////////
// Confirmation //
//////////////////
Registry.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  registry_self = app.modules.returnModule("Registry");

  // browsers check to see if the name has been registered 
  // after 1 confirmation, assuming that servers will be 
  // processing the request on the zeroth-confirmation
  if (conf == 0) {

    if (app.BROWSER == 1) {
      if (tx.transaction.to[0].add != app.wallet.returnPublicKey()) { return; }
      full_identifier = tx.transaction.msg.requested_identifier + "@" + app.modules.returnModule("Registry").domain;
      app.dns.fetchRecordFromAppropriateServer(full_identifier, function(answer, publickey="") {
        if (answer == app.wallet.returnPublicKey()) {
          app.keys.addKey(app.wallet.returnPublicKey(), full_identifier, 0);
	  app.keys.saveKeys();
	  app.wallet.updateIdentifier(full_identifier);
	}
      });
    }
  }  



  //
  // only one server will run this function... the registry.
  //
  // anyone else who wants to run it can tweak the function, but should
  // edit the email bit so that we don't auto-send an email to every
  // user who registers from every single server.
  if (tx.transaction.to[0].add != registry_self.publickey) { return; }

  if (conf == 0) {

    // servers-only
    if (app.BROWSER == 1) { return; }
    if (tx.transaction.msg != null) {

      full_identifier = tx.transaction.msg.requested_identifier + "@" + app.modules.returnModule("Registry").domain;

      // avoid SQL attack
      if (full_identifier.indexOf("'") > 0) { return; }

      tmsql = "SELECT count(*) AS count FROM mod_registry_addresses WHERE identifier = $identifier";
      params = { $identifier : full_identifier }
      app.storage.queryDatabase(tmsql, params, function(err, row) {
        if (row != null) {
          if (row.count == 0) {

	    var msgtosign   = full_identifier + tx.transaction.from[0].add + tx.transaction.ts;
	    var registrysig = app.crypt.signMessage(msgtosign, app.wallet.returnPrivateKey()); 
            var sql = "INSERT OR IGNORE INTO mod_registry_addresses (identifier, publickey, unixtime, signature) VALUES ($identifier, $publickey, $unixtime, $sig)";
            var params = { $identifier : full_identifier, $publickey : tx.transaction.from[0].add, $unixtime : tx.transaction.ts , $sig : registrysig };

	    // write SQL to independent file
	    var sqlwrite = "INSERT OR IGNORE INTO mod_registry_addresses (identifier, publickey, unixtime, signature) VALUES ('"+full_identifier+"','"+tx.transaction.from[0].add+"',"+tx.transaction.ts+", '"+registrysig+"');\n";
	    fs.appendFileSync((__dirname + "/web/addresses.txt"), sqlwrite, function(err) {
	      if (err) {
	        return console.log(err);
	      }
	    });

            app.storage.execDatabase(sql, params, function() {
            
	      // only main signing server needs handle this
              if (tx.transaction.to[0].add == registry_self.publickey && registry_self.publickey == registry_self.app.wallet.returnPublicKey()) { 

                to = tx.transaction.from[0].add;
                from = app.wallet.returnPublicKey();
                amount = 0.0;
                fee = 1.905;

                server_email_html = 'You can now receive emails (and more!) at this address:<p></p>'+tx.transaction.msg.requested_identifier+'@'+app.modules.returnModule("Registry").domain+'<p></p>To configure your browser to use this address, <div class="register_email_address_success" style="text-decoration:underline;cursor:pointer;display:inline;">please click here</div>.';

                newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
    	        if (newtx == null) { return; }
                newtx.transaction.msg.module = "Email";
                newtx.transaction.msg.data   = server_email_html;
                newtx.transaction.msg.title  = "Address Registration Success!";
                newtx = app.wallet.signTransaction(newtx);

                // because we are a server, we add this to our mempool
                // before we send it out. This prevents the transaction
                // from getting rejected if sent back to us and never
                // included in a block if we are the only one handling
                // transactions.
                app.blockchain.mempool.addTransaction(newtx);
                app.network.propagateTransaction(newtx);

	      }
            });

          } else {

            // identifier already registered
            to = tx.transaction.from[0].add;
            from = app.wallet.returnPublicKey();
            amount = 2;
            fee = 3;

            server_email_html = full_identifier + ' is already registered';

            newtx = app.wallet.createUnsignedTransactionWithFee(to, amount, fee);
            if (newtx == null) { return; }
            newtx.transaction.msg.module = "Email";
            newtx.transaction.msg.data   = server_email_html;
            newtx.transaction.msg.title  = "Address Registration Failure!";
            newtx = app.wallet.signTransaction(newtx);

            // servers add to mempool before sending. this avoids loopback failure
            app.blockchain.mempool.addTransaction(newtx);
            app.network.propagateTransaction(newtx);

          }
        }
      });
    }
  }
}


/////////////////////////
// Handle DNS Requests //
/////////////////////////
Registry.prototype.handleDomainRequest = function handleDomainRequest(app, message, peer, mycallback) {

  identifier = message.data.identifier;
  publickey  = message.data.publickey;

  dns_response            = {};
  dns_response.err        = "";
  dns_response.publickey  = "";
  dns_response.identifier = "";


  if (identifier != null) {
    sql = "SELECT * FROM mod_registry_addresses WHERE identifier = $identifier";
    params = { $identifier : identifier };
    app.storage.queryBlockchain(sql, params, function (err, row) {
      if (row != null) {
        if (row.publickey != null) {
	    dns_response.publickey  = row.publickey;
	    dns_response.identifier = row.identifier;
	    mycallback(JSON.stringify(dns_response));
        }
      } else {
        dns_response.err = "identifier not found";
	mycallback(JSON.stringify(dns_response));
      }
    });
  }

  if (publickey != null) {
    sql = "SELECT * FROM mod_registry_addresses WHERE publickey = $publickey";
    params = { $publickey : publickey };
    app.storage.queryBlockchain(sql, params, function (err, row) {
      if (row != null) {
        if (row.publickey != null) {
          dns_response.publickey  = row.publickey;
          dns_response.identifier = row.identifier;
          mycallback(JSON.stringify(dns_response));
        }
      } else {
        dns_response.err = "publickey not found";
        mycallback(JSON.stringify(dns_response));
      }
    });
  }

}














