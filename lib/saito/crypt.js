var crypt  = exports;
var crypto = require('crypto-browserify');
var sha256 = require('sha256');
const { randomBytes } = require('crypto');
var merkle = require('merkle-tree-gen');
// c-code for servers
//const secp256k1 = require('secp256k1')
// js-code for browsers
const secp256k1 = require('secp256k1/elliptic')




/////////////////
// CONSTRUCTOR //
/////////////////
function Crypt() {

  if (!(this instanceof Crypt)) {
    return new Crypt();
  }

  return this;

}
module.exports = Crypt;






////////////////////////
// Hashing Algorithms //
////////////////////////
Crypt.prototype.hash = function hash(text) {
  return sha256(text);
}






////////////////////////////////
// Elliptical Curve Computing //
////////////////////////////////
Crypt.prototype.generateKeys = function generateKeys() {
  let privateKey
  do {
    privateKey = randomBytes(32)
  } while (!secp256k1.privateKeyVerify(privateKey, false))
  return privateKey.toString('hex');
}
Crypt.prototype.returnPublicKey = function returnPublicKey(privkey) {
  return this.compressPublicKey(secp256k1.publicKeyCreate(Buffer.from(privkey,'hex'), false).toString('hex'));
}
Crypt.prototype.signMessage = function signMessage(msg, privkey) {
  return secp256k1.sign(Buffer.from(this.hash(msg),'hex'), Buffer.from(privkey,'hex')).signature.toString('hex');
}
Crypt.prototype.verifyMessage = function verifyMessage(msg, sig, pubkey) {
  return secp256k1.verify(Buffer.from(this.hash(msg),'hex'), Buffer.from(sig,'hex'), Buffer.from(this.uncompressPublicKey(pubkey),'hex'));
}
Crypt.prototype.compressPublicKey = function compressPublicKey(pubkey) {
  return secp256k1.publicKeyConvert(Buffer.from(pubkey,'hex'), true).toString('hex');
}
Crypt.prototype.uncompressPublicKey = function uncompressPublicKey(pubkey) {
  return secp256k1.publicKeyConvert(Buffer.from(pubkey,'hex'), false).toString('hex');
}








////////////////////////////////////////
// Merkle Tree Hashing and Operations //
////////////////////////////////////////
Crypt.prototype.merkleTree = function merkleTree(arrayToMerkle) {

  var args = {
    // The hashes must be of the same hash type as 'hashalgo' 
    array: arrayToMerkle,
    hashalgo: 'sha256', // optional, defaults to sha256 
    hashlist: false     // false means input content not sha256 hashes
  };


  // Generate the tree 
  var mt = null;

  merkle.fromArray(args, function (err, tree) { 

    //if (!err) {
    //    console.log('Merkle root hash: ' + tree.root);
    //    console.log(' -- leaves: ' + tree.leaves);
    //    console.log(' -- levels: ' + tree.levels);
    //}

    mt = tree;

  });

  return mt;

}












