var saito        = require('../saito');
var net          = require('net');
var http         = require('http');
var util         = require('util');
var fs           = require('fs');
var path         = require('path');


function Server(app, serverjson="") {

  if (!(this instanceof Server)) {
    return new Server(app, serverjson);
  }

  this.app               = app || {};

  this.blocks_dir        = path.join(__dirname, '../data/blocks/');
  this.server            = {};
  this.server.host       = "";
  this.server.port       = 0;
  this.server.publickey  = "";
  this.webserver         = null;
  this.io                = null;

  if (serverjson != "") {
    this.server = JSON.parse(serverjson);
  }

  return this;

}
module.exports = Server;



Server.prototype.initialize = function initialize() {

  if (this.app.BROWSER == 1) { return; }

  this.server.publickey = this.app.wallet.returnPublicKey();

  if (this.app.options.server != null) {
    this.server.host = this.app.options.server.host;
    this.server.port = this.app.options.server.port;
  }
  if (this.server.host == "" || this.server.port == 0) {
    console.log("Not starting local server as no hostname / port in options file");
    return;
  }

  var server_self = this;

  var app 	   = require('express')();
  const fileUpload = require('express-fileupload');
  var webserver    = require('http').Server(app);
  var io 	   = require('socket.io')(webserver);

  const bodyParser = require('body-parser');
  app.use(bodyParser.urlencoded({ extended: true }));

  app.use(fileUpload()); 
 

  ///////////////////////
  // blocks on request //
  ///////////////////////
  app.get('/blocks/:blockfile', function (req, res) {
    var blkf = req.params.blockfile;
    var dirfile = server_self.blocks_dir + blkf;
    if (blkf.indexOf('..') != -1) { return; }
    res.sendFile(dirfile);
    return;
  });



  /////////////////////////
  // general web content //
  /////////////////////////
  app.all('/', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
  });
  app.get('/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  app.get('/roadmap.html', function (req, res) {
    res.sendFile(__dirname + '/web/roadmap.html');
    return;
  });
  app.get('/docs/intro.html', function (req, res) {
    res.sendFile(__dirname + '/web/docs/intro.html');
    return;
  });
  app.get('/docs/transactions.html', function (req, res) {
    res.sendFile(__dirname + '/web/docs/transactions.html');
    return;
  });
  app.get('/img/graphs/saitonet.001.jpeg', function (req, res) {
    res.sendFile(__dirname + '/web/img/graphs/saitonet.008.jpeg');
    return;
  });
  app.get('/img/graphs/saitonet.002.jpeg', function (req, res) {
    res.sendFile(__dirname + '/web/img/graphs/saitonet.002.jpeg');
    return;
  });
  app.get('/img/graphs/saitonet.003.jpeg', function (req, res) {
    res.sendFile(__dirname + '/web/img/graphs/saitonet.003.jpeg');
    return;
  });
  app.get('/img/graphs/saitonet.004.jpeg', function (req, res) {
    res.sendFile(__dirname + '/web/img/graphs/saitonet.004.jpeg');
    return;
  });
  app.get('/img/graphs/saitonet.005.jpeg', function (req, res) {
    res.sendFile(__dirname + '/web/img/graphs/saitonet.005.jpeg');
    return;
  });
  app.get('/img/graphs/saitonet.006.jpeg', function (req, res) {
    res.sendFile(__dirname + '/web/img/graphs/saitonet.006.jpeg');
    return;
  });
  app.get('/img/graphs/saitonet.007.jpeg', function (req, res) {
    res.sendFile(__dirname + '/web/img/graphs/saitonet.007.jpeg');
    return;
  });
  app.get('/img/graphs/saitonet.008.jpeg', function (req, res) {
    res.sendFile(__dirname + '/web/img/graphs/saitonet.008.jpeg');
    return;
  });
  app.get('/img/graphs/saitonet.009.jpeg', function (req, res) {
    res.sendFile(__dirname + '/web/img/graphs/saitonet.009.jpeg');
    return;
  });


  app.get('/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  app.get('/browser.js', function (req, res) {

    // gzipped, cached -- if you enable cached 
    // and gzipped, be sure to manually edit the 
    // content-length to reflect the size of the 
    // file
    //res.setHeader("Cache-Control", "public");
    //res.setHeader("Content-Encoding", "gzip");
    //res.setHeader("Content-Length", "368432");
    //res.sendFile(__dirname + '/web/browser.js.gz');

    // non-gzipped, non-cached
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.setHeader("expires","-1");
    res.setHeader("pragma","no-cache");
    res.sendFile(__dirname + '/web/browser.js');
    return;
  });
  app.get('/client.options', function (req, res) {
    server_self.app.storage.saveClientOptions();
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.setHeader("expires","-1");
    res.setHeader("pragma","no-cache");
    res.sendFile(__dirname + '/web/client.options');
    return;
  });
  app.get('/img/saito_logo_white.png', function (req, res) {
    res.sendFile(__dirname + '/web/img/saito_logo_white.png');
    return;
  });
  app.get('/img/saito_logo_black.png', function (req, res) {
    res.sendFile(__dirname + '/web/img/saito_logo_black.png');
    return;
  });
  app.get('/img/saito_logo_grey.png', function (req, res) {
    res.sendFile(__dirname + '/web/img/saito_logo_grey.png');
    return;
  });


  ////////////
  // jquery //
  ////////////
  app.get('/jquery/jquery-3.2.1.min.js', function (req, res) {
    res.sendFile(__dirname + '/web/lib/jquery/jquery-3.2.1.min.js');
    return;
  });
  app.get('/jquery/jquery-ui.min.js', function (req, res) {
    res.sendFile(__dirname + '/web/lib/jquery/jquery-ui.min.js');
    return;
  });
  app.get('/jquery/jquery-ui.min.css', function (req, res) {
    res.sendFile(__dirname + '/web/lib/jquery/jquery-ui.min.css');
    return;
  });


  ////////////
  // qrcode //
  ////////////
  app.get('/qrcode/qrcode.min.js', function (req, res) {
    res.sendFile(__dirname + '/web/lib/qrcode/qrcode.min.js');
    return;
  });


  //////////////
  // fancybox //
  //////////////
  app.get('/fancybox/jquery.fancybox.css', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/jquery.fancybox.css');
    return;
  });
  app.get('/fancybox/jquery.fancybox.pack.js', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/jquery.fancybox.pack.js');
    return;
  });
  app.get('/fancybox/jquery.fancybox-buttons.css', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/jquery.fancybox-buttons.css');
    return;
  });
  app.get('/fancybox/jquery.fancybox-buttons.js', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/jquery.fancybox-buttons.js');
    return;
  });
  app.get('/fancybox/jquery.fancybox-media.js', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/jquery.fancybox-media.js');
    return;
  });
  app.get('/fancybox/jquery.fancybox-thumbs.css', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/jquery.fancybox-thumbs.css');
    return;
  });
  app.get('/fancybox/jquery.fancybox-thumbs.js', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/jquery.fancybox-thumbs.js');
    return;
  });

  /////////////////////
  // fancybox assets //
  /////////////////////
  app.get('/fancybox/blank.gif', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/blank.gif');
    return;
  });
  app.get('/fancybox/fancybox_loading.gif', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/fancybox_loading.gif');
    return;
  });
  app.get('/fancybox/fancybox_loading@2x.gif', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/fancybox_loading@2x.gif');
    return;
  });
  app.get('/fancybox/fancybox_overlay.png', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/fancybox_overlay.png');
    return;
  });
  app.get('/fancybox/fancybox_sprite.png', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/fancybox_sprite.png');
    return;
  });
  app.get('/fancybox/fancybox_sprite@2x.png', function (req, res) {
    res.sendFile(__dirname + '/web/lib/fancybox/fancybox_sprite@2x.png');
    return;
  });

  //////////////////
  // font awesome //
  //////////////////
  app.get('/font-awesome/css/font-awesome.min.css', function (req, res) {
    res.sendFile(__dirname + '/web/lib/font-awesome/css/font-awesome.min.css');
    return;
  });
  app.get('/font-awesome/fonts/FontAwesome.otf', function (req, res) {
    res.sendFile(__dirname + '/web/lib/font-awesome/fonts/FontAwesome.otf');
    return;
  });
  app.get('/font-awesome/fonts/fontawesome-webfont.eot', function (req, res) {
    res.sendFile(__dirname + '/web/lib/font-awesome/fonts/fontawesome-webfont.eot');
    return;
  });
  app.get('/font-awesome/fonts/fontawesome-webfont.svg', function (req, res) {
    res.sendFile(__dirname + '/web/lib/font-awesome/fonts/fontawesome-webfont.svg');
    return;
  });
  app.get('/font-awesome/fonts/fontawesome-webfont.ttf', function (req, res) {
    res.sendFile(__dirname + '/web/lib/font-awesome/fonts/fontawesome-webfont.ttf');
    return;
  });
  app.get('/font-awesome/fonts/fontawesome-webfont.woff', function (req, res) {
    res.sendFile(__dirname + '/web/lib/font-awesome/fonts/fontawesome-webfont.woff');
    return;
  });
  app.get('/font-awesome/fonts/fontawesome-webfont.woff2', function (req, res) {
    res.sendFile(__dirname + '/web/lib/font-awesome/fonts/fontawesome-webfont.woff2');
    return;
  });

  /////////////////
  // module data //
  /////////////////
  this.app.modules.webServer(app);

  webserver.listen(this.server.port);

  // update network with new peer
  io.on('connection', function (socket) {
    server_self.app.network.addPeerWithSocket(socket);
  });

}

Server.prototype.returnServer = function returnServer() {
  this.server.publickey = this.app.wallet.returnPublicKey();
  return this.server;
}
Server.prototype.returnServerJson = function returnServerJson() {
  return JSON.stringify(this.returnServer());
}


