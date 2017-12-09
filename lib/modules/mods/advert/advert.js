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
function Advert(app) {

  if (!(this instanceof Advert)) { return new Advert(app); }

  Advert.super_.call(this);

  this.app             = app;
  this.name            = "Advert";
  this.browser_active  = 1;		// enables initializeHTML function

  return this;

}
module.exports = Advert;
util.inherits(Advert, ModTemplate);





////////////////////
// Install Module //
////////////////////
Reddit.prototype.installModule = function installModule() {

  var sql = 'CREATE TABLE IF NOT EXISTS mod_advert_users (\
                id INTEGER, \
                publickey TEXT, \
                UNIQUE (publickey), \
                PRIMARY KEY(id ASC) \
        )';
  this.app.storage.execDatabase(sql, {}, function() {});

}





/////////////////////////
// Handle Web Requests //
/////////////////////////
Advert.prototype.webServer = function webServer(app, expressapp) {

  expressapp.get('/advert/:publickey', function (req, res) {
    res.sendFile(__dirname + '/web/img/001.jpg');
    return;
  });

}



////////////
// Advert //
////////////
Advert.prototype.initializeHTML = function initializeHTML() {
  
  if (this.app.BROWSER == 0) { return; }

  $('#advert-402-302').html('<img style="width:402px;height:302px" src="/advert/'+this.app.wallet.returnPublicKey()+'" />');

}



