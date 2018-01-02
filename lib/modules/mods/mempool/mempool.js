var saito       = require('../../../saito');
var ModTemplate = require('../../template');
var util        = require('util');
var fs          = require('fs');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Mempool(app) {

  if (!(this instanceof Mempool)) { return new Mempool(app); }
  Mempool.super_.call(this);

  this.app             = app;
  this.name            = "Mempool";

  return this;

}
module.exports = Mempool;
util.inherits(Mempool, ModTemplate);





/////////////////////////
// Handle Web Requests //
/////////////////////////
Mempool.prototype.webServer = function webServer(app, expressapp) {

  var mempool_self = this;

  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/mempool/', function (req, res) {
    fs.writeFileSync((__dirname + "/web/index.html"), mempool_self.returnIndexHTML(app), function(err) {
      if (err) {
        return console.log(err);
      }
    });
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
}


Mempool.prototype.returnIndexHTML = function returnIndexHTML(app) {

return '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Mempool Explorer</title> \
  <link rel="stylesheet" type="text/css" href="/info/style.css" /> \
</head> \
<body> \
\
    <div class="header"> \
      <a href="/" style="text-decoration:none;color:inherits"> \
        <img src="/img/saito_logo_black.png" style="width:35px;margin-top:5px;margin-left:25px;margin-right:10px;float:left;" /> \
        <div style="font-family:Georgia;padding-top:0px;font-size:1.2em;color:#444;">saito</div> \
      </a> \
    </div> \
\
    <div class="main"> \
      Server Address: '+this.app.wallet.returnPublicKey()+' \
      <p></p> \
      '+app.blockchain.mempool.debugHTML()+' \
    </div> \
\
</body> \
</html>';

}



