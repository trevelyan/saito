// this manually creates blocks and adds them to the blockchain
// one-by-one in various incomplete orders in order to test that
// our blockchain reorganization logic is working properly and 
// we correctly identify the longest chain when new blocks are
// added.
//
// copy this to the main directly if you want to play around with
// it.
//
var t       = exports;
    t.utils = require('../trust/utils');
var trust   = require('../trust');


var app            = {};


// application runs in server-mode by default. Change BROWSERIFY
// to 1 and a few internal operations change to run in browser /
// lite-mode.
//
// examples include loading the config file from the browser 
// storage cache, and loading a module that tries to setup DOM
// interaction with a browser-based terminal
app.BROWSERIFY = 0;


app.storage    = new trust.storage(app);
app.storage.loadOptions();
app.blockchain = new trust.blockchain(app);
app.crypt      = new trust.crypt();
app.wallet     = new trust.wallet(app);
app.network    = new trust.network(app);


if (app.BROWSERIFY == 0) {

  app.server     = new trust.server(app);
  app.network.connect();

} else {

  app.browser    = new trust.browser(app);

}

app.modules    = require('./modules/mods')(app);






///////////////////////////
// Start the Application //
///////////////////////////

// this starts the process of producing blocks on 
// a difficulty timer. If we have already initialized
// the network, we will already have a blockchain we
// can build upon.
if (app.BROWSERIFY == 0) {
  //app.blockchain.mempool.startBundling();
}

     
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
            console.log(app.blockchain.index.hash);
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




