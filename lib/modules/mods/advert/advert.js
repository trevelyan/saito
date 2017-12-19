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
  this.advert_img_dir  = "/home/lancashi/software/saito/lib/modules/mods/advert/web/cache/";
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

  var sql2 = 'CREATE TABLE IF NOT EXISTS mod_advert_adverts (\
                id INTEGER, \
                publickey TEXT, \
                link TEXT, \
                views INTEGER, \
                height INTEGER, \
                width INTEGER, \
                budget INTEGER, \
                PRIMARY KEY(id ASC) \
  )';
  this.app.storage.execDatabase(sql2, {}, function() {});

}






////////////////
// Initialize //
////////////////
Advert.prototype.initialize = function initialize() {

  if (this.browser_active == 0) { return; }

  if (this.app.BROWSER == 1) {

    var reddit_self = this;

    var rdloadtimer = setTimeout(function() {
      message                 = {};
      message.request         = "advert load adverts";
      message.data            = {};
      message.data.request    = "advert load adverts";
      message.data.publickey  = reddit_self.app.wallet.returnPublicKey();
      reddit_self.app.network.sendRequest(message.request, message.data);
    }, 500);
  }

}






/////////////////////
// Initialize HTML //
/////////////////////
Advert.prototype.initializeHTML = function initializeHTML() {

    if ($('#advert-300-250').length > 0) {

      $.getJSON('/advert/'+this.app.wallet.returnPublicKey(), function (data) {
        if (data.id != null) {
	  htmlToInsert = '<a href="'+data.link+'"><img style="width:300px;height:250px" src="/advert/cache/'+data.id+'.jpg" /></a>';
	} else {
	  htmlToInsert = '<a href="/advert/"><img style="width:300px;height:250px" src="/advert/web/001.jpg" /></a>';
	}
	$('#advert-300-250').html(htmlToInsert);
      });

    }

    // in case we are the upload page
    var a = '/advert/upload/'+this.app.wallet.returnPublicKey();
    $('#uploadForm').attr('action', a);

}
Advert.prototype.attachEvents = function attachEvents() {

}












/////////////////////////
// Handle Web Requests //
/////////////////////////
Advert.prototype.webServer = function webServer(app, expressapp) {

  var advert_self = this;

  expressapp.get('/advert', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/advert/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.get('/advert/cache/:imagefile', function (req, res) {
    var imgf = '/web/cache/'+req.params.imagefile;
    if (imgf.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + imgf);
    return;
  });
  expressapp.post('/advert/upload/:publickey', function (req, res) {

    if (!req.files) { return res.status(400).send('No files were uploaded.'); }

    var uploadUrl  = req.body.uploadUrl;
    var sampleFile = req.files.sampleFile;
    var pkey       = req.params.publickey;

    // insert into database
    var sql = "INSERT OR IGNORE INTO mod_advert_adverts (publickey, link, views, height, width, budget) VALUES ($pkey, $link, 0, 250, 300, 0)";
    var params = { $pkey : pkey , $link : uploadUrl };
    advert_self.app.storage.db.run(sql, params, function(err, row) {

      var newFileName = advert_self.advert_img_dir + this.lastID + ".jpg";
      sampleFile.mv(newFileName, function(err) {
        if (err) { return res.status(500).send(err); }
        res.send('File uploaded: <a href="/advert">Click here</a> and wait a moment for your new advertisement to load');
	res.end();
	return;;
      });

    });
  });
  expressapp.get('/advert/:publickey', function (req, res) {

    if (req.params.publickey == null) { return; }

    var publickey = req.params.publickey;

    var psql = "SELECT count(*) AS count FROM mod_advert_users WHERE publickey = $publickey";
    var pparams = { $publickey : req.params.publickey };
    advert_self.app.storage.queryDatabase(psql, pparams, function(perr, prow) {

      if (prow == null) {

        var psql2 = "SELECT * FROM mod_advert_adverts ORDER BY RANDOM() LIMIT 1";
        advert_self.app.storage.queryDatabase(psql2, {}, function(perr2, prow2) {
	  advert_self.sendAdvert(prow2, res);
	});

      }

      if (prow.count == 0) {

        var sql = "INSERT OR IGNORE INTO mod_advert_users (publickey, views) VALUES ($publickey, $views)";
        var params = { $publickey : req.params.publickey , $views : 0 };
        advert_self.app.storage.db.run(sql, params, function(err) {

          if (err != null) { return; }
          if (this.lastID > 0) {

	    //////////////////
            // send payment //
	    //////////////////
            newtx = advert_self.app.wallet.createUnsignedTransaction(publickey, 3.0, 2.0);
            if (newtx == null) { return; }
            newtx.transaction.msg.module = "Email";
            newtx.transaction.msg.title  = "Saito Advertising - Transaction Receipt";
            newtx.transaction.msg.data   = 'You have received 3 tokens from the Saito Advertising Network for viewing your first advertisement. In the future, you will receive a payment at random roughly once for every 1000 advertisements you view. If you would like to post an advertisement on our network, please send a message to david@satoshi';
            newtx = advert_self.app.wallet.signTransaction(newtx);
            advert_self.app.blockchain.mempool.addTransaction(newtx);
            advert_self.app.network.propagateTransaction(newtx);

          }
        });
      } else {

	if (advert_self.app.wallet.returnBalance() > 200) {
	  if (Math.random() < 0.001) {

	    //////////////////////////////////////////////
            // send payment every 1000 times on average //
	    //////////////////////////////////////////////
            newtx = advert_self.app.wallet.createUnsignedTransaction(publickey, 100.0, 2.0);
            if (newtx == null) { return; }
            newtx.transaction.msg.module = "Email";
            newtx.transaction.msg.title  = "Saito Advertising - Bonus Payment";
            newtx.transaction.msg.data   = 'You have received 100 tokens from the Saito Advertising Network.';
            newtx = advert_self.app.wallet.signTransaction(newtx);
            advert_self.app.blockchain.mempool.addTransaction(newtx);
            advert_self.app.network.propagateTransaction(newtx);

          }
        }

      }

      var sql2 = "UPDATE mod_advert_users SET views = views+1 WHERE publickey = $publickey";
      var params2 = { $publickey : req.params.publickey };
      advert_self.app.storage.execDatabase(sql2, params2, function(err) {

        var psql2 = "SELECT * FROM mod_advert_adverts ORDER BY RANDOM() LIMIT 1";
        advert_self.app.storage.queryDatabase(psql2, {}, function(perr2, prow2) {
	  advert_self.sendAdvert(prow2, res);
	});

      });
    });
  });
}
Advert.prototype.sendAdvert = function sendAdvert(prow, res) {

  var msg = JSON.stringify(prow);

console.log("SENDING: ");
console.log(msg);

  res.setHeader('Content-type', 'text/html');
  res.charset = 'UTF-8';
  res.write(msg);
  res.end();
  return;

}






//////////////////////////
// Handle Peer Requests //
//////////////////////////
Advert.prototype.handlePeerRequest = function handlePeerRequest(app, message, peer, mycallback) {

    ///////////////////////
    // server -- adverts //
    ///////////////////////
    if (message.request === "advert load adverts") {

      var pkey   = message.data.publickey;
      var sql    = "SELECT * FROM mod_advert_adverts WHERE publickey = $pkey";
      var params = { $pkey : pkey };

      app.storage.queryDatabaseArray(sql, params, function(err, rows) {
        if (rows != null) {
          for (var fat = rows.length-1; fat >= 0; fat--) {
            var message                 = {};
            message.request         = "advert load response";
            message.data            = {};
            message.data.id         = rows[fat].id;
            message.data.link       = rows[fat].link;
            message.data.height     = rows[fat].height;
            message.data.width      = rows[fat].width;
            peer.sendRequest(message.request, message.data);
          }
        }
      });
      return;
    }




    ///////////////////////
    // client -- adverts //
    ///////////////////////
    if (message.request === "advert load response") {

      var advert_id   = message.data.id;
      var advert_link = message.data.link;

      var toInsert = '<div><img src="/advert/cache/'+advert_id+'.jpg" style="height:150px;width:125px;" /><a style="margin-left:10px" href="'+advert_link+'">'+advert_link+'</a></div>';

      $('#adverts').append(toInsert);
      $('#adverts').css('display','block');

      return;
    }

}





