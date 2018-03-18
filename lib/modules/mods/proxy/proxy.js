var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


// Simple-Socks module does not work if it is contained within our Proxy class
//
// note that we need to edit the proxyData variable in the NPM version of 
// simple-socks so that it sends the socket var to us as well as the data
//

///////////////
// VARIABLES //
///////////////
var thisapp = null;
var proxy_host = '127.0.0.1';
var proxy_port = 4001;




/////////////////////
// CREATE DATABASE //
/////////////////////
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./data/proxy.sq3');






if (1) {
//if (0) {

///////////////////////////////////////////
// initialize here to avoid ERRADDRINUSE //
///////////////////////////////////////////
var socks5    = require('simple-socks/lib');
var server    = socks5.createServer();
/*
  server        = socks5.createServer({
  authenticate : function (username, password, callback) {
    // verify username/password
    if (username !== 'henry' || password !== 'henry') {
      // any error 
      return setImmediate(callback, new Error('invalid credentials'));
    }
    // success
    return setImmediate(callback);
  }
});
*/




server.listen(proxy_port, proxy_host, function () {
  console.log('SOCKS5 proxy server started on 127.0.0.1:4001');
});
////////////////////////
// initial connection //
////////////////////////
server.on('handshake', function (socket) {
  console.log();
  console.log('------------------------------------------------------------');
  console.log('new socks5 client from %s:%d', socket.remoteAddress, socket.remotePort);
});

/////////////////////
// website request //
/////////////////////
server.on('proxyConnect', function (info, destination) {

  //var sql = "INSERT OR IGNORE INTO mod_proxy (remoteAddress, data_used, data_limit) VALUES ($remoteAddress, $data_used, $data_limit)";
  //var params = {
  //  $remoteAddress : info.host,
  //  $data_used     : 0,
  //  $data_limit    : 2000000000000
  //}
  //db.run(sql, params, function(err) {});

//console.log(sql);
//console.log(params);

  console.log('connected to remote server at %s:%d', info.host, info.port);
  destination.on('data', function (data) {
    console.log(data.length);
  });

});
/////////////////////
// send data chunk //
/////////////////////
server.on('proxyData', function (data, socket) {

  console.log("SENDING DATA: " + data.length + " -- " + socket.remoteAddress);

  //var sql2    = "UPDATE mod_proxy SET data_used = data_used + $data_length WHERE remoteAddress = $remoteAddress";
  //var params2 = { $remoteAddress : socket.remoteAddress , $data_length : data.length };
//console.log(sql2);
//console.log(params2);
//
  //db.run(sql2, params2, function() {});

});
/////////////////////////////////
// errors - connecting to site //
/////////////////////////////////
server.on('proxyError', function (err) {
  console.error('unable to connect to remote server');
  console.error(err);
});
////////////////////////////
// close proxy connection //
////////////////////////////
server.on('proxyEnd', function (response, args) {
  console.log('socket closed with code %d', response);
  console.log(args);
  console.log();
});


}




//////////////////
// CONSTRUCTOR  //
//////////////////
function Proxy(app) {

  if (!(this instanceof Proxy)) { return new Proxy(app); }
  Proxy.super_.call(this);

  this.app             = app;
  this.name            = "Proxy";
  this.handlesEmail    = 1;
  this.emailAppName    = "HTTP Proxy";

  this.host            = proxy_host;
  this.port            = proxy_port;
  this.publickey       = "fXJKih2Vo3nZB5ofqBTHr8T4u2gUtd168oTC8MtU8QKG";

  this.initialize();
  return this;

}
module.exports = Proxy;
util.inherits(Proxy, ModTemplate);


Proxy.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_proxy (\
                id INTEGER, \
                host TEXT, \
                port INTEGER, \
                publickey TEXT, \
                username TEXT, \
                password TEXT, \
                data_used INTEGER, \
                data_limit INTEGER, \
                unixtime TEXT, \
                PRIMARY KEY(id ASC) \
        )";

  db.run(sql, {}, function() { console.log("Socks Proxy Database Tables Created"); });

}
Proxy.prototype.initialize = function initialize() {
  thisapp = this.app;
}







/////////////////////
// Email Callbacks //
/////////////////////
Proxy.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');

  element_to_edit_html = '<div id="module_instructions" class="module_instructions">We run a pay-to-use HTTP proxy at '+proxy_host+' on port '+proxy_port+'. Top-up your account by sending a Saito transaction to this address.</div>';
  element_to_edit.html(element_to_edit_html);

  // auto-input correct address and payment amount
  $('#lightbox_compose_to_address').val(this.publickey);
  $('#lightbox_compose_payment').val(2);
  $('#lightbox_compose_fee').val(2);

}
/////////////////////
// Display Message //
/////////////////////
Proxy.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  var proxy_self = this;

  if (app.BROWSER == 1) {
    message_text_selector = "#" + message_id + " > .data";
    $('#lightbox_message_text').html( $(message_text_selector).html() );
    $('#lightbox_compose_to_address').val(proxy_self.publickey);
    $('#lightbox_compose_payment').val(3);
    $('#lightbox_compose_fee').val(2);
  }

}
////////////////////////
// Format Transaction //
////////////////////////
Proxy.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {
  tx.transaction.msg.module = this.name;
  return tx;
}









//////////////////
// Confirmation //
//////////////////
Proxy.prototype.onConfirmation = function onConfirmation(blk, tx, conf, app) {

  proxy_self = app.modules.returnModule("Proxy");

  if (app.BROWSER == 1) { return; }

console.log("\n\n\nHERE WE ARE 1...\n");

  if (conf == 0) {

console.log("\n\n\nHERE WE ARE 2...\n");
    /////////////////////
    // only our server //
    /////////////////////
console.log(tx.transaction.to[0].add + " ---- " + proxy_self.publickey);

    if (tx.transaction.to[0].add == proxy_self.publickey) {
console.log("\n\n\nHERE WE ARE 3...\n");

      var tmsql = "SELECT count(*) AS count FROM mod_proxy WHERE publickey = $publickey";
      var params = { $publickey : tx.transaction.from[0].add }
      app.storage.queryDatabase(tmsql, params, function(err, row) {
	if (row != null) {

console.log("\n\n\nHERE WE ARE 4...\n");
	  /////////////////
	  // NEW ACCOUNT //
	  /////////////////
	  if (row.count == 0) {
console.log("\n\n\nHERE WE ARE 5...\n");
            var sql = "INSERT INTO mod_proxy (publickey, username, password, data_used, data_limit) VALUES ($publickey, $username, $password, $data_used, $data_limit)";
            var params = {
              $publickey : tx.transaction.from[0].add,
	      $username  : "henry",
	      $password  : "henry",
	      $data_used : 0,
	      $data_limit : 200000000
            }
            proxy_self.app.storage.db.run(sql, params, function(err) {
	    });

	  /////////////////
	  // NEW ACCOUNT //
	  /////////////////
	  } else {

console.log("\n\n\nHERE WE ARE 6...\n");
            var sql = "UPDATE mod_proxy SET data_limit = data_limit + 200000000 WHERE publickey = $publickey";
            var params = {
              $publickey : tx.transaction.from[0].add
            }
            proxy_self.app.storage.db.run(sql, params, function(err) {
	    });
          }
	}
      });
    }
  }
}



