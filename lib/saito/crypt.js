var crypt             = exports;
var crypto            = require('crypto-browserify');
var sha256            = require('sha256');
var merkle            = require('merkle-tree-gen');
var node_cryptojs     = require('node-cryptojs-aes');
const { randomBytes } = require('crypto');
const secp256k1       = require('secp256k1')

var CryptoJS = node_cryptojs.CryptoJS;
var JsonFormatter = node_cryptojs.JsonFormatter;
var Base58 = require("base-58");


/////////////////
// CONSTRUCTOR //
/////////////////
function Crypt() {
  if (!(this instanceof Crypt)) { return new Crypt(); }
  return this;
}
module.exports = Crypt;


//////////
// Hash //
//////////
Crypt.prototype.hash = function hash(text) { 
  return sha256(sha256(text));
}


////////////////
// Elliptical //
////////////////
Crypt.prototype.compressPublicKey = function compressPublicKey(pubkey) {
  return this.toBase58(secp256k1.publicKeyConvert(Buffer.from(pubkey,'hex'), true).toString('hex'));
}
Crypt.prototype.fromBase58 = function fromBase58(pubkey) {
  return Buffer.from(Base58.decode(pubkey), 'Uint8Array').toString('hex');
}
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
  return this.toBase58(secp256k1.sign(Buffer.from(this.hash(Buffer.from(msg, 'utf-8').toString('base64')),'hex'), Buffer.from(privkey,'hex')).signature.toString('hex'));
}
Crypt.prototype.toBase58 = function toBase58(pubkey) {
  return Base58.encode(new Buffer(pubkey, 'hex'));
}
Crypt.prototype.uncompressPublicKey = function uncompressPublicKey(pubkey) {
  return secp256k1.publicKeyConvert(Buffer.from(this.fromBase58(pubkey),'hex'), false).toString('hex');
}
Crypt.prototype.verifyMessage = function verifyMessage(msg, sig, pubkey) {
  return secp256k1.verify(Buffer.from(this.hash(Buffer.from(msg, 'utf-8').toString('base64')),'hex'), Buffer.from(this.fromBase58(sig),'hex'), Buffer.from(this.uncompressPublicKey(pubkey),'hex'));
}


//////////////////
// Merkle Trees //
//////////////////
Crypt.prototype.returnMerkleTree = function returnMerkleTree(inarray) {
  var mt   = null;
  var args = {
    array: inarray,
    hashalgo: 'sha256',
    hashlist: false
  };
  merkle.fromArray(args, function (err, tree) { mt = tree; });
  return mt;
}


////////////////////
// Diffie Hellman //
////////////////////
Crypt.prototype.createDiffieHellman = function createDiffieHellman(pubkey="",privkey="") {
  var ecdh   = crypto.createECDH("secp256k1");
  ecdh.generateKeys();
  if (pubkey != "")  { ecdh.setPublicKey(pubkey); }
  if (privkey != "") { ecdh.setPrivateKey(privkey); }
  return ecdh;
}
Crypt.prototype.returnDiffieHellmanKeys = function returnDiffieHellmanKeys(dh) {
  var keys = {};
  keys.pubkey  = dh.getPublicKey(null, "compressed");
  keys.privkey = dh.getPrivateKey(null, "compressed");
  return keys;
}
Crypt.prototype.createDiffieHellmanSecret = function createDiffieHellmanSecret(a_dh, b_pubkey) {
  return a_dh.computeSecret(b_pubkey);
}
Crypt.prototype.aesEncrypt = function aesEncrypt(msg, secret) {
  var rp = new Buffer(secret.toString("hex"), "hex").toString("base64");
  var en = CryptoJS.AES.encrypt(msg, rp, { format: JsonFormatter });
  return en.toString();
}
Crypt.prototype.aesDecrypt = function aesDecrypt(msg, secret) {
  var rp = new Buffer(secret.toString("hex"), "hex").toString("base64");
  var de = CryptoJS.AES.decrypt(msg, rp, { format: JsonFormatter });
  return CryptoJS.enc.Utf8.stringify(de);
}

