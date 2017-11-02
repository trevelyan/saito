var saito = require('./saito');
var keythereum = require('keythereum');

var app            = {};
    app.BROWSER    = 0;
    app.SPVMODE    = 0;




////////////////////////////////////////////////////
// THIS SHOULD BE REMOVED FOR THE BROWSER VERSION //
////////////////////////////////////////////////////
//
// Keythereum workaround
//
// This avoid an issue with our payment module -- a bug in Keythereum on Mac
// prevents it from running properly the first time the software is executed.
// We avoid this by forcing key-generation on startup.
//
function generateEthereumKeys() {
  var params = { keyBytes: 32, ivBytes: 16 };var dk = keythereum.create(params);
  var options = { kdf: "pbkdf2", cipher: "aes-128-ctr", kdfparams: { c: 262144, dklen: 32, prf: "hmac-sha256" } };
  var password = "ethereum";
  var keyObject = keythereum.dump(password, dk.privateKey, dk.salt, dk.iv, options);
  var keys = {};
      keys.public  = "0x" + keyObject.address;
      keys.private = keythereum.recover(password, keyObject).toString('hex');
  return keys;
} generateEthereumKeys();




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
app.modules    = require('./modules/mods')(app);



////////////////
// Initialize //
////////////////
app.storage.initialize();
//
app.wallet.initialize();
app.aes.initialize();
app.keys.initialize();
app.network.initialize();
// archives before modules
app.archives.initialize();
app.modules.initialize();
// server initialized after modules
// so that the modules can use the
// server to feed their own subpages
// as necessary
// network before classes that manage specialized peers
app.server.initialize();
// dns before browser so modules can initialize with dns requests, after ntwork
app.dns.initialize();
app.blockchain.initialize();
app.browser.initialize();


var welcome = '\
\n\
\n\
Welcome to Saito \n\
\n\
address: ' + app.wallet.returnPublicKey() + '\n\
balance: ' + app.wallet.returnBalance() + '\n\
\n\
Above is the address and balance of this computer on the Saito network. Many of our \n\
server modules require your account to have tokens in it in order to send emails. If \n\
you do not have any Saito tokens we recommend we recommend visiting our main Saito \n\
faucet to get some: \n\
\n\
http://saito.tech:12100/faucet \n\
\n\
Once Saito is running it will generate tokens automatically over-time. You can increase \n\
your likelihood of generating tokens by processing more transactions and serving more \n\
lite-clients. The more transactions you process the greater the likelihood that your \n\
computer will be rewarded for its work. \n\
\n\
Questions or comments? Please contact us anytime at: david@satoshi \n\
\n\n';
console.log(welcome);


////////////////////////////////////////////////////
// THIS SHOULD BE REMOVED FOR THE BROWSER VERSION //
////////////////////////////////////////////////////
setTimeout(function() {
  app.blockchain.mempool.startBundling();
}, 1000);




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



