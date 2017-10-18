var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var request = require("request");



//////////////////
// CONSTRUCTOR  //
//////////////////
function Subscription(app) {

  if (!(this instanceof Subscription)) { return new Subscription(app); }

  Subscription.super_.call(this);

  this.app             = app;


  // this is the name that shows up in the 
  // email module.
  this.name                = "Subscription";
  this.browser_active      = 0;
  this.handlesEmail        = 0;
  this.handlesPeerRequests = 0;

  this.token_limit         = 25000;
  this.eth_subscription    = 0.1;

  return this;

}
module.exports = Subscription;
util.inherits(Subscription, ModTemplate);





////////////////////
// Install Module //
////////////////////
Subscription.prototype.installModule = function installModule() {

  if (this.app.BROWSER == 1) { return; }

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_subscriptions (\
                id INTEGER, \
                publickey TEXT, \
                tokens_sent INTEGER, \
                unixtime INTEGER, \
                PRIMARY KEY(id ASC) \
        )";
  this.app.storage.execDatabase(sql, {}, function() {});

}





//////////////////////////
// Handle Peer Requests //
//////////////////////////
//
// monitor new connections and send money to new keys
// 
Subscription.prototype.handlePeerRequest = function handlePeerRequest(app, message, peer) {

  if (app.BROWSER == 1) { return; }

console.log("1");
  if (message.request == "connect") {
console.log("2");
    if (message.data.request_tokens == 1) {
console.log("3");
      if (message.data.publickey != "") {
console.log("4");
        if (app.wallet.returnBalance() > 22) { 
console.log("5");

	  //var sql = "SELECT count(*) AS count FROM mod_subscriptions WHERE publickey = $publickey";
 	  //var params = { $publickey : message.data.publickey };
	  //app.storage.queryDatabase(sql, params, function(err, row) {
	  //  if (row != null) {
	  //    if (row.count == 0) {

		// new user, send some tokens
	  //	var signup_ts = new Date().getTime();
	  //	var sql2 = "INSERT INTO mod_subscriptions (publickey, tokens_sent, unixtime) VALUES ($publickey, $tokens_sent, $unixtime)";
 	  //	var params2 = { $publickey : message.data.publickey , $tokens_sent : 20, $unixtime : signup_ts };
	  //	app.storage.queryDatabase(sql2, params2, function(err2, row2) {
 		  console.log("\nSENDING 20 PAYMENT: ");
            	  var nt = app.wallet.createUnsignedTransactionWithFee(message.data.publickey, 20, 2.0);
console.log(nt);
            	  nt = app.wallet.signTransaction(nt);
console.log(nt);
            	  app.blockchain.mempool.addTransaction(nt); 
            	  app.network.propagateTransaction(nt); 
console.log("6");
	  //      });

	  //    }
          //  }
	  //});

        } 
      }
    }
  }

}




