var saito = require('../saito');


function Keys(app) {

  if (!(this instanceof Keys)) {
    return new Keys(app);
  }

  this.app         = app || {};
  this.keys        = [];

  return this;
  
}
module.exports = Keys;



Keys.prototype.initialize = function initialize() {

  for (var i = 0; i < this.app.options.keys.length; i++) {
    var tk               = this.app.options.keys[i];

    var k                = new saito.key();
        k.publickey      = tk.publickey;
        k.watched        = tk.watched;
        k.aes_publickey  = tk.aes_publickey;
        k.aes_privatekey = tk.aes_privatekey;
        k.aes_secret     = tk.aes_secret;
        k.identifiers    = [];
        k.tags           = [];

        for (var m = 0; m < tk.identifiers.length; m++) {
 	  k.identifiers[m] = tk.identifiers[m];
        }
        for (var m = 0; m < tk.tags.length; m++) {
 	  k.tags[m] = tk.tags[m];
        }
    this.keys.push(k);
  }


}



// this can also add identifiers and kes to existing keys
//
// it can upgrade keys to "watched" status but not downgrade watched keys.
//
Keys.prototype.addKey = function addKey(publickey, identifier = "", watched = 0, tag = "") {

  if (publickey == "") { return; }

  var tmpkey = this.findByPublicKey(publickey);
  if (tmpkey == null) {
    tmpkey                = new saito.key();
    tmpkey.publickey      = publickey;
    tmpkey.watched        = watched;
    if (identifier != "") { tmpkey.addIdentifier(identifier); }
    if (tag != "")        { tmpkey.addTag(tag); }
    this.keys.push(tmpkey);
  } else {
    if (identifier != "") { tmpkey.addIdentifier(identifier); }
    if (tag != "")        { tmpkey.addTag(tag); }
    if (watched == 1) { tmpkey.watched = 1; }
  }
  this.saveKeys();
}
Keys.prototype.decryptMessage = function decryptMessage(publickey, msg) {

  // submit JSON parsed object after unencryption
  for (var x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey) {
      if (this.keys[x].aes_secret != "") {
        var tmpmsg = this.app.crypt.aesDecrypt(msg, this.keys[x].aes_secret);
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
Keys.prototype.encryptMessage = function encryptMessage(publickey, msg) {

  // turn submitted msg object into JSON and then encrypt it, or
  // return the original unencrypted object
  var jsonmsg = JSON.stringify(msg);

  for (var x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey) {
      if (this.keys[x].aes_secret != "") {
        return this.app.crypt.aesEncrypt(jsonmsg, this.keys[x].aes_secret);
      }
    }
  }

  return msg;
}
Keys.prototype.findByPublicKey = function findByPublicKey(publickey) {
console.log(JSON.stringify(this.keys));
  for (var x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey) { return this.keys[x]; }
  }
  return null;
}
Keys.prototype.findByIdentifier = function findByIdentifier(identifier) {
  for (var x = 0; x < this.keys.length; x++) {
    if (this.keys[x].isIdentifier(identifier) == 1) { return this.keys[x]; }
  }
  return null;
}
Keys.prototype.hasSharedSecret = function hasSharedSecret(publickey) {
  for (var x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey || this.keys[x].isIdentifier(publickey) == 1) {
      if (this.keys[x].hasSharedSecret() == 1) {
        return 1;
      }
    }
  }
  return 0;
}
Keys.prototype.isWatched = function isWatched(publickey) {
  for (var x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey || this.keys[x].isIdentifier(publickey) == 1) {
      if (this.keys[x].isWatched() == 1) {
        return 1;
      }
    }
  }
  return 0;
}
Keys.prototype.initializeKeyExchange = function initializeKeyExchange(publickey) {

  var alice            = this.app.crypt.createDiffieHellman();
  var alice_publickey  = alice.getPublicKey(null, "compressed").toString("hex");
  var alice_privatekey = alice.getPrivateKey(null, "compressed").toString("hex");
  this.updateCryptoByPublicKey(publickey, alice_publickey, alice_privatekey, "");
  return alice_publickey;

}

Keys.prototype.isTagged = function isTagged(publickey, tag) {
  var x = this.findByPublicKey(publickey);
  if (x == null) { return 0; }
  return x.isTagged(tag);
}
Keys.prototype.saveKeys = function saveKeys() {
  this.app.options.keys = this.returnKeys();
  this.app.storage.saveOptions();
}
Keys.prototype.removeKey = function removeKey(publickey) {
  for (var x = this.keys.length-1; x >= 0; x--) {
    if (this.keys[x].publickey == publickey) {
      this.keys.splice(x, 1);
    }
  }
}
Keys.prototype.removeKeyByIdentifierAndKeyword = function removeKeywordByIdentifierAndKeyword(identifier, tag) {
  for (var x = this.keys.length-1; x >= 0; x--) {
    if (this.keys[x].isIdentifier(identifier) && this.keys[x].isTagged(tag)) {
      this.removeKey(this.keys[x].publickey);
      return;
    }
  }
}
Keys.prototype.returnKeysByTag = function returnKeysByTag(tag) {
  var kx = [];
  for (var x = 0; x < this.keys.length; x++) {
    if (this.keys[x].isTagged(tag) == 1) { kx[kx.length] = this.keys[x]; }
  }
  return kx;
}
Keys.prototype.returnKeys = function returnKeys() {
  return this.keys;
}
Keys.prototype.returnKeysJson = function returnKeysJson() {
  return JSON.stringify(this.returnKeys());
}
Keys.prototype.returnPublicKeyByIdentifier = function returnPublicKeyByIdentifier(identifier) {
  for (var x = 0; x < this.keys.length; x++) {
    if (this.keys[x].isIdentifier(identifier) == 1) { return this.keys[x].publickey; }
  }
  return "";
}
Keys.prototype.returnWatchedPublicKeys = function returnWatchedPublicKeys() {
  var x = [];
  for (var i = 0; i < this.keys.length; i++) {
    if (this.keys[i].isWatched() == 1) {
      x.push(this.keys[i].publickey);
    }
  }
  return x;
}
Keys.prototype.updateCryptoByPublicKey = function updateCryptoByPublicKey(publickey, aes_publickey = "", aes_privatekey = "", shared_secret = "") {

  if (publickey == "") { return; }

  this.addKey(publickey);

  for (var x = 0; x < this.keys.length; x++) {
    if (this.keys[x].publickey == publickey) {
      this.keys[x].aes_publickey  = aes_publickey;
      this.keys[x].aes_privatekey = aes_privatekey;
      this.keys[x].aes_secret     = shared_secret;
    }
  }

  this.saveKeys();

  return 0;
}

