var saito         = require('../saito');

function Key() {

  if (!(this instanceof Key)) {
    return new Key();
  }

  this.publickey      = "";
  this.tags           = [];
  this.identifiers    = [];
  this.watched        = 0;
  this.aes_publickey  = "";
  this.aes_privatekey = "";
  this.aes_secret     = "";

  return this;

}
module.exports = Key;


Key.prototype.addTag = function addTag(tag) {
  if (this.isTagged(tag) == 0) { this.tags.push(tag); }
}
Key.prototype.addIdentifier = function addIdentifier(identifier) {
  if (this.isIdentifier(identifier) == 0) { this.identifiers.push(identifier); }
}
Key.prototype.hasSharedSecret = function hasSharedSecret() {
  if (this.aes_secret != "") { return 1; }
  return 0;;
}
Key.prototype.isIdentifier = function isIdentifier(identifier) {
  for (var x = 0; x < this.identifiers.length; x++) {
    if (this.identifiers[x] == identifier) { return 1; }
  }
  return 0;
}
Key.prototype.isWatched = function isWatched(publickey) {
  return this.watched;
}
Key.prototype.isTagged = function isTagged(tag) {
  for (var x = 0; x < this.tags.length; x++) {
    if (this.tags[x] == tag) { return 1; }
  }
  return 0;
}
Key.prototype.removeIdentifier = function removeIdentifier(identifier) {
  if (this.isIdentifier(identifier) == 0) { return; }
  for (var x = this.identifiers.length-1; x >= 0; x++) {
    if (this.identifiers[x] == identifier) {
      this.identifiers.splice(x, 1);
    }
  }
}
Key.prototype.removeTag = function removeTag(tag) {
  if (this.isTagged(tag) == 0) { return; }
  for (var x = this.tags.length-1; x >= 0; x++) {
    if (this.tags[x] == tag) {
      this.tags.splice(x, 1);
    }
  }
}

