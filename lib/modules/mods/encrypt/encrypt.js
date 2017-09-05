var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Encrypt(app) {

  if (!(this instanceof Encrypt)) { return new Encrypt(app); }

  Encrypt.super_.call(this);

  this.app             = app;

  this.name            = "Encrypt";
  this.handlesEmail    = 1;

  this.email_view_txid = 0;

  return this;

}
module.exports = Encrypt;
util.inherits(Encrypt, ModTemplate);




/////////////////////
// Email Functions //
/////////////////////
Encrypt.prototype.displayEmailForm = function displayEmailForm(app) {

  element_to_edit = $('#module_editable_space');
  element_to_edit.html('<div style="min-height:100px;padding-top:120px;padding:40px;font-size:1.6em;line-height:2.4em;">Encrypt email to protect your privacy. Click SEND to initiate a Diffie-Hellman key-exchange over the blockchain. You will be notified when the receiver authorizes your request, and subsequent email with them will be automatically encrypted.</div>');

}
Encrypt.prototype.formatEmailTransaction = function formatEmailTransaction(tx, app) {

  link_id    = "authorize_link_"+this.email_view_txid;

  // always set the message.module to the name of the app
  tx.transaction.msg.module  = this.name;
  tx.transaction.msg.request = "key exchange request";
  tx.transaction.msg.title   = "Key-Exchange Request";
  email_html = 'You have received a request for encrypted communications from the sender of this email.<p></p>To authorize this request, <div class="authorize_link" id="'+link_id+'" style="display:inline;text-decoration:underline;cursor:pointer">click here</div>.';
  tx.transaction.msg.data    = email_html;

  // return OUR public key submitting THEIR publickey
  tx.transaction.msg.alice_publickey = app.aes.initializeKeyExchange(tx.transaction.to[0].add);

console.log("\nINITIALIZED ALICE WITH PUBLICKEY: ");
console.log(tx.transaction.msg.alice_publickey);

  return tx;

}
Encrypt.prototype.displayEmailMessage = function displayEmailMessage(message_id, app) {

  if (app.BROWSER == 1) {
    this.email_view_txid = message_id.substring(8);
    message_text_selector = "#" + message_id + " > .data";
    authbody = $(message_text_selector).html();

    $('#lightbox_message_text').html(authbody);

    // update authorize link ID
    message_text_selector = ".lightbox_message_text > .authorize_link";
    new_auth_link = "authorize_link_"+this.email_view_txid;
    $(message_text_selector).attr('id', new_auth_link);
  }

}










//////////////////
// Confirmation //
//////////////////
Encrypt.prototype.onConfirmation = function onConfirmation(tx, conf, app) {

  if (conf == 0) {

    var sender           = tx.transaction.from[0].add;
    var receiver         = tx.transaction.to[0].add;
    var request          = tx.transaction.msg.request;  // "request"
		
    /////////////////////////
    // requests made to us //
    /////////////////////////
    if (receiver == app.wallet.returnPublicKey()) {

      // someone wants to key exchange
      if (tx.transaction.msg.request == "key exchange request") {

        msg                 = {};
        msg.id              = tx.transaction.id;
        msg.from            = sender;
        msg.time            = tx.transaction.ts;
        msg.module          = "Encrypt";
        msg.title           = tx.transaction.msg.title;
        msg.data            = tx.transaction.msg.data;;
        msg.alice_publickey = tx.transaction.msg.alice_publickey;

        app.modules.returnModule("Email").attachMessage(msg, app);
        app.archives.saveMessage(tx);

      }


      // confirming shared secret
      if (tx.transaction.msg.request == "key exchange confirm") {

        msg        = {};
        msg.id     = tx.transaction.id;
        msg.from   = sender;
        msg.time   = tx.transaction.ts;
        msg.module = "Encrypt";
        msg.title  = tx.transaction.msg.title;
        msg.data   = tx.transaction.msg.data;;
        

	// generate the shared secret
	bob_publickey = new Buffer(tx.transaction.msg.bob, "hex");;

	//
console.log("THESE KEYS TO CHECK: ");
console.log(app.aes.keys);
console.log("for this ADDRESS: ");
console.log(sender);

	senderkeydata = app.aes.findByPublicKey(sender);
	if (senderkeydata == null) { if (app.BROWSER == 1) { alert('Cannot find our original DH keys for key exchange'); return; } }

	alice_publickey  = new Buffer(senderkeydata.my_publickey, "hex");
	alice_privatekey = new Buffer(senderkeydata.my_privatekey, "hex");

	alice            = app.crypt.createDiffieHellman(alice_publickey, alice_privatekey);
        alice2_publickey    = alice.getPublicKey(null, "compressed").toString("hex");
        alice2_privatekey   = alice.getPrivateKey(null, "compressed").toString("hex");
        alice_secret     = app.crypt.createDiffieHellmanSecret(alice, bob_publickey);


        // update local AES information
        app.aes.updateCryptoByPublicKey(sender, alice_publickey.toString("hex"), alice_privatekey.toString("hex"), alice_secret);
        app.aes.saveAes();

        app.modules.returnModule("Email").attachMessage(msg, app);
        app.archives.saveMessage(tx);


      }
    }
  }

}






Encrypt.prototype.attachEmailEvents = function attachEmailEvents(app) {

  if (app.BROWSER == 1) {

    // fancybox does not want us to attach events by #id so we
    // have to handle it by class. This is a bug in their software
    $('.authorize_link').off();
    $('.authorize_link').on('click', function() {

      txid = $(this).attr('id');
      txid = txid.substring(15);

      thistx = app.archives.returnTransactionById(txid);

console.log("SENDING CONF: ");
console.log(txid);
console.log(thistx);

      if (thistx == null) { return; }

      remote_address = thistx.transaction.from[0].add;
      alice_publickey = thistx.transaction.msg.alice_publickey;

      // generate shared secret and save
      bob              = app.crypt.createDiffieHellman();
      bob_publickey    = bob.getPublicKey(null, "compressed").toString("hex");
      bob_privatekey   = bob.getPrivateKey(null, "compressed").toString("hex");
      bob_secret       = app.crypt.createDiffieHellmanSecret(bob, new Buffer(alice_publickey, "hex"));


console.log("RECEIVED ALICE KEY: ");
console.log(alice_publickey);
console.log("GENERATED BOBS pub/priv KEYS");
console.log(bob_publickey);
console.log(bob_privatekey);

      // save encryption information
      app.aes.updateCryptoByPublicKey(thistx.transaction.from[0].add, bob_publickey, bob_privatekey, bob_secret);
      app.aes.saveAes();


      // send plaintext confirmation, returning publickey used for encryption
console.log("CREATED DIFFIE-HELLMAN SECRET: ");
console.log(bob_secret.toString("hex"));

      email_html = 'You have authorized a key-exchange request from: <p></p>'+app.modules.returnModule("Email").formatAuthor(remote_address, app)+'<p></p>Your future correspondence will be encrypted with a shared-secret only known to your two accounts.';

      utx = app.wallet.createUnsignedTransactionWithFee(remote_address, 0.005, 0.005);
      utx.transaction.msg.module  = "Encrypt";
      utx.transaction.msg.request = "key exchange confirm";
      utx.transaction.msg.tx_id   = txid;		// reference id for parent tx
      utx.transaction.msg.title   = "Key-Exchange Success";
      utx.transaction.msg.data    = email_html;
      utx.transaction.msg.bob     = bob_publickey;

      utx = app.wallet.signTransaction(utx);
      app.blockchain.mempool.addTransaction(utx);
      app.network.propagateTransaction(utx);

      $.fancybox.close();

      app.modules.returnModule("Email").showBrowserAlert("key-exchange completed");

    });
  }
}






