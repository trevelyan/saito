var saito        = require('../saito');
var net          = require('net');
var http         = require('http');
var util         = require('util');
//var EventEmitter = require('events').EventEmitter;



function Server(app) {

  if (!(this instanceof Server)) {
    return new Server(app);
  }

  //EventEmitter.call(this);

  this.app               = app || {};

  this.server           = {};
  this.server.host      = "localhost";
  this.server.port      = 12100;
  this.server.publickey = "";

  this.webserver         = null;
  this.io                = null;


  return this;

}
//util.inherits(Server, EventEmitter);
module.exports = Server;







Server.prototype.returnServer = function returnServer() {
  this.server.publickey = this.app.wallet.returnPublicKey();
  return this.server;
}
Server.prototype.returnServerJson = function returnServerJson() {
  return JSON.stringify(this.returnServer());
}



Server.prototype.initialize = function initialize() {

  if (this.app.BROWSERIFY == 1) { return; }

  var app = require('express')();
  var webserver = require('http').Server(app);
  var io = require('socket.io')(webserver);

  server_self = this;



  ///////////////////
  // web resources //
  ///////////////////
  app.get('/', function (req, res) {
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  app.get('/client.json', function (req, res) {

    // regenerate the client json file
    server_self.app.storage.saveClientOptions();

    res.sendFile(__dirname + '/web/client.json');
    return;
  });
  app.get('/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  app.get('/jquery-3.2.1.min.js', function (req, res) {
    res.sendFile(__dirname + '/web/jquery-3.2.1.min.js');
    return;
  });
  app.get('/jquery-ui.min.js', function (req, res) {
    res.sendFile(__dirname + '/web/jquery-ui.min.js');
    return;
  });
  app.get('/jquery-ui.min.css', function (req, res) {
    res.sendFile(__dirname + '/web/jquery-ui.min.css');
    return;
  });


  //////////////
  // fancybox //
  //////////////
  app.get('/fancybox/jquery.fancybox.css', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/jquery.fancybox.css');
    return;
  });
  app.get('/fancybox/jquery.fancybox.pack.js', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/jquery.fancybox.pack.js');
    return;
  });
  app.get('/fancybox/jquery.fancybox-buttons.css', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/jquery.fancybox-buttons.css');
    return;
  });
  app.get('/fancybox/jquery.fancybox-buttons.js', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/jquery.fancybox-buttons.js');
    return;
  });
  app.get('/fancybox/jquery.fancybox-media.js', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/jquery.fancybox-media.js');
    return;
  });
  app.get('/fancybox/jquery.fancybox-thumbs.css', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/jquery.fancybox-thumbs.css');
    return;
  });
  app.get('/fancybox/jquery.fancybox-thumbs.js', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/jquery.fancybox-thumbs.js');
    return;
  });


  /////////////////////
  // fancybox assets //
  /////////////////////
  app.get('/fancybox/blank.gif', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/blank.gif');
    return;
  });
  app.get('/fancybox/fancybox_loading.gif', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/fancybox_loading.gif');
    return;
  });
  app.get('/fancybox/fancybox_loading@2x.gif', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/fancybox_loading@2x.gif');
    return;
  });
  app.get('/fancybox/fancybox_overlay.png', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/fancybox_overlay.png');
    return;
  });
  app.get('/fancybox/fancybox_sprite.png', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/fancybox_sprite.png');
    return;
  });
  app.get('/fancybox/fancybox_sprite@2x.png', function (req, res) {
    res.sendFile(__dirname + '/web/fancybox/fancybox_sprite@2x.png');
    return;
  });


  webserver.listen(this.server.port);

  // update network with new peer
  io.on('connection', function (socket) {
    console.log("CONNECTION adding socket to peer list...");
    server_self.app.network.addPeerWithSocket(socket);
  });

}







