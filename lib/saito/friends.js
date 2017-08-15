var saito         = require('../saito');


function Friends(app, friendjson="") {

  if (!(this instanceof Friends)) {
    return new Friends(app, friendjson);
  }

  this.app = app || {};
  this.friends = [];


  if (friendjson != "") {
    this.friends = JSON.parse(friendjson);
  }

  return this;

}
module.exports = Friends;


Friends.prototype.initialize = function initialize() {

  if (this.app.options.friends == null) { this.app.options.friends = []; }

  for (i = 0; i < this.app.options.friends.length; i++) {
    this.addFriend(this.app.options.friends[i].publickey, this.app.options.friends[i].identifier);
  }

}





Friends.prototype.addFriend = function addFriend(publickey, identifier) {

  tmpfriend = {};
  tmpfriend.publickey = publickey;
  tmpfriend.identifier = identifier;
 
  for (xmn = 0; xmn < this.friends.length; xmn++) {
    if (JSON.stringify(this.friends[xmn]) == JSON.stringify(tmpfriend)) { return; }
  }

  this.friends.push(tmpfriend);
  this.app.storage.saveOptions();

}
Friends.prototype.findByPublicKey = function findByPublicKey(publickey) {

  for (xmn = 0; xmn < this.friends.length; xmn++) {
    if (this.friends[xmn].publickey == publickey) { return this.friends[xmn]; }
  }

  return null;
}
Friends.prototype.findByIdentifier = function findByIdentifier(identifier) {

  for (xmn = 0; xmn < this.friends.length; xmn++) {
    if (this.friends[xmn].identifier == identifier) { return this.friends[xmn]; }
  }

  return null;
}


Friends.prototype.returnFriendsPublicKeyArray = function returnFriendsPublicKeyArray() {
  tfa = [];
  for (tfai = 0; tfai < this.friends.length; tfai++) {
    tfa.push(this.friends[tfai].publickey);
  }
  return tfa;
}
Friends.prototype.returnFriends = function returnFriends() {
  return this.friends;
}
Friends.prototype.returnFriendsJson = function returnFriendsJson() {
  return JSON.stringify(this.returnFriends);
}

