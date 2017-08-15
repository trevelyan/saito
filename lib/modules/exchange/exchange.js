var saito = require('../../saito');
var ModTemplate = require('../template');
var util = require('util');





//////////////////
// CONSTRUCTOR  //
//////////////////
function Exchange(app) {

  if (!(this instanceof Exchange)) { return new Exchange(app); }
  Exchange.super_.call(this);

  this.app             = app;
  this.name            = "Exchange";
  return this;

}
module.exports = Exchange;
util.inherits(Exchange, ModTemplate);










////////////////////
// Install Module //
////////////////////
Exchange.prototype.installModule = function installModule() {

  sql = "\
        CREATE TABLE IF NOT EXISTS mod_exchanges (\
                id INTEGER, \
                buyer_eth_address TEXT, \
                buyer_saito_address TEXT, \
                seller_eth_address TEXT, \
                seller_saito_address TEXT, \
                saito TEXT, \
                ethereum TEXT, \
                PRIMARY KEY(id ASC) \
        )";


  // database reads and writes are non-blocking, so you need a callback function if you want
  // to do anything after insert. Parameters are sql query, params and the callback function
  this.app.storage.execDatabase(sql, {}, function() {});


}







//////////////////
// Confirmation //
//////////////////
Exchange.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  // ignore unless this is intended for us
  if (tx.transaction.to[0].returnAddress() != app.wallet.returnPublicKey()) { return; }

  // confirm receipt on zero conf
  if (conf == 0) {

    // send email -- confirm trade in process

  }


  if (conf == 20) {

    // execute trade

  }


}







/////////////////////////
// Handle Web Requests //
/////////////////////////
Exchange.prototype.webServer = function webServer(app, expressapp) {


  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/exchange/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/exchange/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });


}







///////////////////
// Attach Events //
///////////////////
Exchange.prototype.attachEvents = function attachEvents(app) {

      if (app.BROWSERIFY == 0) { return; }

      exchange_self = this;

}

Exchange.prototype.initializeHTML = function initializeHTML(app) {

}








