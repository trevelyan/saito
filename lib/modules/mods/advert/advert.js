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
Advert.prototype.installModule = function installModule() {

  var sql = 'CREATE TABLE IF NOT EXISTS mod_advert_users (\
                id INTEGER, \
                publickey TEXT, \
                views INTEGER, \
                UNIQUE (publickey), \
                PRIMARY KEY(id ASC) \
        )';
  this.app.storage.execDatabase(sql, {}, function() {});

}





/////////////////////////
// Handle Web Requests //
/////////////////////////
Advert.prototype.webServer = function webServer(app, expressapp) {

  var advert_self = this;

  expressapp.get('/advert/:publickey', function (req, res) {

    if (req.params.publickey == null) { return; }

    var publickey = req.params.publickey;

    var psql = "SELECT count(*) AS count FROM mod_advert_users WHERE publickey = $publickey";
    var pparams = { $publickey : req.params.publickey };
    advert_self.app.storage.queryDatabase(psql, pparams, function(perr, prow) {

      if (prow == null) { 
        res.sendFile(__dirname + '/web/img/001.jpg');
        return;
      }

      if (prow.count == 0) {

        var sql = "INSERT OR IGNORE INTO mod_advert_users (publickey, views) VALUES ($publickey, $views)";
        var params = { $publickey : req.params.publickey , $views : 0 };
        advert_self.app.storage.db.run(sql, params, function(err) {

          if (err != null) { return; }

          if (this.lastID > 0) {

console.log("\nMAKING PAYMENT FROM ADVERT: "+this.lastID+"\n");

            // send an email
            newtx = advert_self.app.wallet.createUnsignedTransaction(publickey, 3.0, 2.0);
            if (newtx == null) { return; }
            newtx.transaction.msg.module = "Email";
            newtx.transaction.msg.title  = "Saito Advertising - Transaction Receipt";
            newtx.transaction.msg.data   = 'You have received 3 tokens from the Saito Advertising Fund.';
            newtx = advert_self.app.wallet.signTransaction(newtx);
            advert_self.app.blockchain.mempool.addTransaction(newtx);
            advert_self.app.network.propagateTransaction(newtx);

          }

        });

      }

      var sql2 = "UPDATE mod_advert_users SET views = views+1 WHERE publickey = $publickey";
      var params2 = { $publickey : req.params.publickey };

      advert_self.app.storage.execDatabase(sql2, params2, function(err) {
        res.sendFile(__dirname + '/web/img/001.jpg');
        return;
      });

    });

  });

}



////////////
// Advert //
////////////
Advert.prototype.initializeHTML = function initializeHTML() {
  
  if (this.app.BROWSER == 0) { return; }

  $('#advert-402-302').html('<img style="width:402px;height:302px" src="/advert/'+this.app.wallet.returnPublicKey()+'" />');

}



