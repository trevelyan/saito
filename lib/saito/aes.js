var saito         = require('../saito');


function Aes(app) {

  if (!(this instanceof Aes)) {
    return new Aes(app);
  }

  this.app = app || {};
  this.keys = [];

  return this;

}
module.exports = Aes;


Aes.prototype.initialize = function initialize() {

  if (this.app.options.aes == null) { this.app.options.aes = []; }

  for (i = 0; i < this.app.options.aes.length; i++) {
    this.addKey(this.app.options.aes[i].publickey, this.app.options.aes[i].my_publickey, this.app.options.aes[i].my_privatekey, this.app.options.aes[i].shared_secret);
  }

}


Aes.prototype.addKey = function addKey(publickey, my_publickey = "", my_privatekey = "", shared_secret = "") {

  var tmpkey               = {};
  tmpkey.publickey     = publickey;
  tmpkey.my_publickey  = my_publickey;
  tmpkey.my_privatekey = my_privatekey;
  tmpkey.shared_secret = shared_secret;

  for (var xmn = 0; xmn < this.keys.length; xmn++) {
    if (JSON.stringify(this.keys[xmn]) == JSON.stringify(tmpkey)) { 
      console.log("  refusing to add key: "+JSON.stringify(tmpkey));
      return; 
    }
  }

  // update instead of saving if new identifier on existing pubkey
  for (var xmn = 0; xmn < this.keys.length; xmn++) {
    if (this.keys[xmn].publickey == publickey) {
      this.keys[xmn].my_publickey     = my_publickey;
      this.keys[xmn].my_privatekey    = my_privatekey;
      this.keys[xmn].my_shared_secret = shared_secret;
      return; 
    }
  }

  this.keys.push(tmpkey);

}
Aes.prototype.updateCryptoByPublicKey = function updateCryptoByPublicKey(publickey, my_publickey = "", my_privatekey = "", shared_secret = "") {

  if (publickey == "") { return; }

  for (var xmn = 0; xmn < this.keys.length; xmn++) {
    if (this.keys[xmn].publickey == publickey) { 

      this.keys[xmn].my_publickey  = my_publickey;
      this.keys[xmn].my_privatekey = my_privatekey;
      this.keys[xmn].shared_secret = shared_secret;

      return 1;

    }
  }


  // we have not found a listing, so we insert a new one
  this.addKey(publickey, my_publickey, my_privatekey, shared_secret);
  this.saveAes();

  return 0;
}
Aes.prototype.findByPublicKey = function findByPublicKey(publickey) {

  for (var xmn = 0; xmn < this.keys.length; xmn++) {
    if (this.keys[xmn].publickey == publickey) { return this.keys[xmn]; }
  }

  return null;
}
Aes.prototype.saveAes = function saveAes() {
  this.app.options.aes = this.returnAes();
  this.app.storage.saveOptions();
}
Aes.prototype.returnAes = function returnAes() {
  return this.keys;
}
Aes.prototype.returnAesJson = function returnAesJson() {
  return JSON.stringify(this.returnAes);
}

Aes.prototype.initializeKeyExchange = function initializeKeyExchange(publickey) {

  var alice            = this.app.crypt.createDiffieHellman();
  var alice_publickey  = alice.getPublicKey(null, "compressed").toString("hex");
  var alice_privatekey = alice.getPrivateKey(null, "compressed").toString("hex");
  this.updateCryptoByPublicKey(publickey, alice_publickey, alice_privatekey, "");
  return alice_publickey;

}

Aes.prototype.hasSharedSecret = function hasSharedSecret(address) {

  for (var xmn = 0; xmn < this.keys.length; xmn++) {
    if (this.keys[xmn].publickey == address) { 
      if (this.keys[xmn].shared_secret != "") {
        return 1;
      }
    }
  }

  return 0;
}
Aes.prototype.encryptMessage = function encryptMessage(address, msg) {  

  // turn submitted msg object into JSON and then encrypt it, or 
  // return the original unencrypted object
  var x = JSON.stringify(msg);

  for (var xmn = 0; xmn < this.keys.length; xmn++) {
    if (this.keys[xmn].publickey == address) { 
      if (this.keys[xmn].shared_secret != "") {
        return this.app.crypt.aesEncrypt(x, this.keys[xmn].shared_secret);
      }
    }
  }

  return msg;
}
Aes.prototype.decryptMessage = function decryptMessage(address, msg) {  

  // submit JSON parsed object after unencryption
  for (var xmn = 0; xmn < this.keys.length; xmn++) {
    if (this.keys[xmn].publickey == address) {
      if (this.keys[xmn].shared_secret != "") {
        var tmpmsg = this.app.crypt.aesDecrypt(msg, this.keys[xmn].shared_secret);
        if (tmpmsg != null) {
	  var tmpx = JSON.parse(tmpmsg);
	  if (tmpx.module != null) {
            return JSON.parse(tmpmsg);
	  }
	}
      }
    }
  }

  // or return the original
  return msg;
}



