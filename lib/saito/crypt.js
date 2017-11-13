var crypt  = exports;
var crypto = require('crypto-browserify');
var sha256 = require('sha256');
var merkle = require('merkle-tree-gen');
var node_cryptojs = require('node-cryptojs-aes');
//
// servers can use c-implementation
//
const secp256k1 = require('secp256k1')
//
// browsers should use js implementation
//
//const secp256k1 = require('secp256k1/elliptic')
const { randomBytes } = require('crypto');
var CryptoJS = node_cryptojs.CryptoJS;
var JsonFormatter = node_cryptojs.JsonFormatter;



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
  //console.log(JSON.stringify(msg.toString('hex')));
  //console.log(this.hash(JSON.stringify(msg.toString('hex'))),'ascii');
  //console.log(Buffer.from(this.hash(JSON.stringify(msg.toString('hex'))),'hex'));
  var myresults = secp256k1.sign(Buffer.from(this.hash(JSON.stringify(msg.toString('hex'))),'hex'), Buffer.from(privkey,'hex')).signature.toString('hex');
  console.log("\nSIG CREATE: "+myresults + " -- " + msg);
  return secp256k1.sign(Buffer.from(this.hash(JSON.stringify(msg.toString('hex'))),'hex'), Buffer.from(privkey,'hex')).signature.toString('hex');
  //return secp256k1.sign(Buffer.from(this.hash(JSON.stringify(msg.toString('hex'))),'hex'), Buffer.from(privkey,'hex')).signature.toString('hex');
}
Crypt.prototype.verifyMessage = function verifyMessage(msg, sig, pubkey) {
  //console.log(JSON.stringify(msg.toString('hex')));
  //console.log(this.hash(JSON.stringify(msg.toString('hex'))),'ascii');
  //console.log(Buffer.from(this.hash(JSON.stringify(msg.toString('hex'))),'hex'));
  console.log("\nSIG CHECK: "+sig+ " -- " + msg);
  return secp256k1.verify(Buffer.from(this.hash(JSON.stringify(msg.toString('hex'))),'hex'), Buffer.from(sig,'hex'), Buffer.from(this.uncompressPublicKey(pubkey),'hex'));
}
Crypt.prototype.compressPublicKey = function compressPublicKey(pubkey) {
  return secp256k1.publicKeyConvert(Buffer.from(pubkey,'hex'), true).toString('hex');
}
Crypt.prototype.uncompressPublicKey = function uncompressPublicKey(pubkey) {
  return secp256k1.publicKeyConvert(Buffer.from(pubkey,'hex'), false).toString('hex');
}



//////////////////
// Merkle Trees //
//////////////////
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



/////////////////////////////////
// Diffie Hellman Key Exchange //
/////////////////////////////////
Crypt.prototype.createDiffieHellman = function createDiffieHellman(publickey="",privatekey="") {
  var tmpECDH   = crypto.createECDH("secp256k1");
  tmpECDH.generateKeys();
  if (publickey != "") { tmpECDH.setPublicKey(publickey); }
  if (privatekey != "") { tmpECDH.setPrivateKey(privatekey); }
  return tmpECDH;
}
Crypt.prototype.returnDiffieHellmanKeys = function returnDiffieHellmanKeys(dh) {
  var keys = {};
  keys.pubkey  = dh.getPublicKey(null, "compressed");
  keys.privkey = dh.getPrivateKey(null, "compressed");
  return keys;
}
Crypt.prototype.createDiffieHellmanSecret = function createDiffieHellmanSecret(myDiffieHellman, theirPublicKey) {
  return myDiffieHellman.computeSecret(theirPublicKey);
}
Crypt.prototype.aesEncrypt = function aesEncrypt(message, secret) {
  var r_pass_base64 = new Buffer(secret.toString("hex"), "hex").toString("base64");
  var encrypted = CryptoJS.AES.encrypt(message, r_pass_base64, { format: JsonFormatter });
  var encrypted_json_str = encrypted.toString();
  return encrypted_json_str;
}
Crypt.prototype.aesDecrypt = function aesDecrypt(encryptedJsonMessage, secret) {
  var r_pass_base64 = new Buffer(secret.toString("hex"), "hex").toString("base64");
  var decrypted = CryptoJS.AES.decrypt(encryptedJsonMessage, r_pass_base64, { format: JsonFormatter });
  var decrypted_str = CryptoJS.enc.Utf8.stringify(decrypted);
  return decrypted_str;
}





