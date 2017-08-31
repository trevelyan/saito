var saito         = require('../saito');


function Keys(app) {

  if (!(this instanceof Keys)) {
    return new Keys(app);
  }

  this.app = app || {};
  this.keys = [];

  return this;

}
module.exports = Keys;


Keys.prototype.initialize = function initialize() {

  if (this.app.options.keys == null) { this.app.options.keys = []; }

  for (i = 0; i < this.app.options.keys.length; i++) {
    this.addKey(this.app.options.keys[i].publickey, this.app.options.keys[i].identifier, this.app.options.keys[i].watch, this.app.options.keys[i].keyword);
  }


}



Keys.prototype.updateIdentifierByKey = function updateIdentifierByKey(publickey, identifier) {

  for (xmn = 0; xmn < this.keys.length; xmn++) {
    if (this.keys[xmn].publickey == publickey) { this.keys[xmn].identifier = idenfitier; return; }
  }

  return;
}
Keys.prototype.removeKeyByIdentifierAndKeyword = function removeKeywordByIdentifierAndKeyword(identifier, keyword) {

  for (xmnn = 0; xmnn < this.keys.length; xmnn++) {
    if (this.keys[xmnn].identifier == identifier && this.keys[xmnn].keyword == keyword) { 
      this.keys.splice(xmnn, 1);
      return;
    }
  }

}


Keys.prototype.addKey = function addKey(publickey, identifier, watch=0, keyword2watch="") {

  tmpkey = {};
  tmpkey.publickey  = publickey;
  tmpkey.identifier = identifier;
  tmpkey.watch      = watch; 
  tmpkey.keyword    = keyword2watch;

  for (xmn = 0; xmn < this.keys.length; xmn++) {
    if (JSON.stringify(this.keys[xmn]) == JSON.stringify(tmpkey)) { 
      console.log("  refusing to add key: "+JSON.stringify(tmpkey));
      return; 
    }
  }

  this.keys.push(tmpkey);

}
Keys.prototype.findByPublicKey = function findByPublicKey(publickey) {

  for (xmn = 0; xmn < this.keys.length; xmn++) {
    if (this.keys[xmn].publickey == publickey) { return this.keys[xmn]; }
  }

  return null;
}
Keys.prototype.findByIdentifier = function findByIdentifier(identifier) {

  for (xmn = 0; xmn < this.keys.length; xmn++) {
    if (this.keys[xmn].identifier == identifier) { return this.keys[xmn]; }
  }

  return null;
}
Keys.prototype.isWatched = function isWatched(publickey) {
  for (xmn = 0; xmn < this.keys.length; xmn++) {
    // check if publickey or watched identifier
    if (this.keys[xmn].publickey == publickey || this.keys[xmn].identifier == publickey) { 
      if (this.keys[xmn].watch == 1) {
        return 1;
      } 
    }
  }

  return 0;
}
Keys.prototype.returnPublicKeyByIdentifier = function returnPublicKeyByIdentifier(identifier) {
  for (xmn = 0; xmn < this.keys.length; xmn++) {
    if (this.keys[xmn].identifier == identifier) { return this.keys[xmn].publickey; }
  }
  return "";
}

Keys.prototype.returnKeywordArray = function returnKeywordArray(keyword_to_check) {
  tfa = [];

  for (tfai = 0; tfai < this.keys.length; tfai++) {
    if (this.keys[tfai].keyword == keyword_to_check) {
      tfa.push(this.keys[tfai]);
    }
  }
  return tfa;
}
Keys.prototype.returnWatchedArray = function returnWatchedArray() {
  tfa = [];
  for (tfai = 0; tfai < this.keys.length; tfai++) {
    if (this.keys[tfai].watch == 1) {
      tfa.push(this.keys[tfai]);
    }
  }
  return tfa;
}
Keys.prototype.returnPublicKeysWatchedArray = function returnPublicKeysWatchedArray() {
  tfa = [];
  for (tfai = 0; tfai < this.keys.length; tfai++) {
    if (this.keys[tfai].watch == 1) {
      tfa.push(this.keys[tfai].publickey);
    }
  }
  return tfa;
}
Keys.prototype.returnKeysPublicKeyArray = function returnKeysPublicKeyArray() {
  tfa = [];
  for (tfai = 0; tfai < this.keys.length; tfai++) {
    tfa.push(this.keys[tfai].publickey);
  }
  return tfa;
}
Keys.prototype.saveKeys = function saveKeys() {
  this.app.options.keys = this.returnKeys();
  this.app.storage.saveOptions();
}
Keys.prototype.returnKeys = function returnKeys() {
  return this.keys;
}
Keys.prototype.returnKeysJson = function returnKeysJson() {
  return JSON.stringify(this.returnKeys);
}

