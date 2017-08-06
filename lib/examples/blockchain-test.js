//
// clean this up, the reference is 
// from the blockchain class
// 
//
var t       = exports;
    t.utils = require('./saito/utils');
var saito   = require('./saito');



var app            = {};
    app.options    = {};


////////////////////
// Load Variables //
////////////////////
app.crypt      = new saito.crypt();
app.storage    = new saito.storage(app);
app.wallet     = new saito.wallet(app);
app.blockchain = new saito.blockchain(app);
app.network    = new saito.network(app);
app.server     = new saito.server(app);
app.browser    = new saito.browser(app);
app.modules    = require('./modules/mods')(app);



////////////////
// Initialize //
////////////////
app.storage.initialize();
app.wallet.initialize();
app.server.initialize();
app.network.initialize();
app.blockchain.initialize();
app.modules.initialize();
app.browser.initialize();







  // callback hell
  var blk1 = trust.block(app);
  console.log("BLOCK 1");
  console.log(blk1.hash());
  var timer3 = setTimeout(function() {

    var blk2 = trust.block(app);
    console.log("BLOCK 2");
    console.log(blk2.hash());

    var blk3 = trust.block(app);
    blk3.createBlock(blk2);
    console.log("BLOCK 3");
    console.log(blk3.hash());

    var blk4 = trust.block(app);
    blk4.createBlock(blk1);
    console.log("BLOCK 4");
    console.log(blk4.hash());

    var blk5 = trust.block(app);
    blk5.createBlock(blk4);
    console.log("BLOCK 4");
    console.log(blk5.hash());

    var timer = setTimeout(function() {

      app.blockchain.addBlock(blk1);
      app.blockchain.addBlock(blk3);

      var timer2 = setTimeout(function() {

        app.blockchain.addBlock(blk4);

        var timer3 = setTimeout(function() {

          app.blockchain.addBlock(blk5);

          var timer4 = setTimeout(function() {

            blk6 = new trust.block(app);
            blk6.createBlock(blk5);

            app.blockchain.addBlock(blk5);
            app.blockchain.addBlock(blk2);

	    app.blockchain.debug();

//            console.log(app.blockchain.index.hash);

          }, 1500);
        }, 1500);
      },1500);
    }, 1500);
  }, 4000);










// create hooks for application closure
// these force the application to close
// sensibly and can be triggered by Cntl-C
// but not Cntl-Z

process.on('SIGTERM', function () {
  app.server.close();
  app.network.close();
  console.log("Network Shutdown");
});
process.on('SIGINT', function () {
  app.server.close();
  app.network.close();
  console.log("Network Shutdown");
});




