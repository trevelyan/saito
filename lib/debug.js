var saito = require('./saito');
var app            = {};
    app.BROWSER    = 0;
    app.SPVMODE    = 0;


////////////////////
// Load Variables //
////////////////////
app.crypt      = new saito.crypt();
app.browser    = new saito.browser(app);
app.archives   = new saito.archives(app);
app.storage    = new saito.storage(app);
app.aes        = new saito.aes(app);
app.dns        = new saito.dns(app);
app.keys       = new saito.keys(app);
app.wallet     = new saito.wallet(app);
app.network    = new saito.network(app);
app.blockchain = new saito.blockchain(app);
app.server     = new saito.server(app);
app.queue      = new saito.queue(app);
app.modules    = require('./modules/mods')(app);



////////////////
// Initialize //
////////////////
app.storage.initialize();
//
app.wallet.initialize();
app.queue.initialize();
// archives before modules
app.archives.initialize();
app.aes.initialize();
app.keys.initialize();
app.modules.initialize();
// server initialized after modules
// so that the modules can use the
// server to feed their own subpages
// as necessary
app.server.initialize();
// network before classes that manage specialized peers
app.network.initialize();
// dns before browser so modules can initialize with dns requests, after ntwork
app.dns.initialize();
app.blockchain.initialize();
app.browser.initialize();


console.log("\n\nWelcome to Saito\n\n");
console.log(app.wallet.returnPublicKey());

//app.blockchain.mempool.startBundling();



  setTimeout(function() {

    console.log("BClen: "+app.blockchain.index.hash.length);

    var blk6 = app.blockchain.returnBlockByHash("458c031954dfc62202e4c1db164fe23f576a6c35db89e73b009ed2562cf46c6f");   


    // create our first forked block
    var fork_blk7 = new saito.block(app);
    fork_blk7.createBlock(blk6);

    // add forked 6 to the blockchain
    app.blockchain.addBlock(fork_blk7);


    tx = app.wallet.createUnsignedTransactionWithFee(app.wallet.returnPublicKey(), 2, 2);
    tx = app.wallet.signTransaction(tx);
    app.blockchain.mempool.addTransaction(tx);
    fork_blk8 = app.blockchain.mempool.createBlock(fork_blk7);

    // add forked 6 to the blockchain
    app.blockchain.addBlock(fork_blk8);



console.log("\n\n\nFork Block Added");





  }, 2000);


/***
  // callback hell
  var blk1 = trust.block(app);
  console.log("BLOCK 1");
  console.log(blk1.hash());
  setTimeout(function() {

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
***/









/////////////////////
// Cntl-C to Close //
/////////////////////
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



