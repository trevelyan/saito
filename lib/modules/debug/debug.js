var saito       = require('../../saito');
var ModTemplate = require('../template');
var util        = require('util');
var fs          = require('fs');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Debug(app) {

  if (!(this instanceof Debug)) { return new Debug(app); }
  Debug.super_.call(this);

  this.app             = app;
  this.name            = "Debug";

  return this;

}
module.exports = Debug;
util.inherits(Debug, ModTemplate);





/////////////////////////
// Handle Web Requests //
/////////////////////////
Debug.prototype.webServer = function webServer(app, expressapp) {

  debug_self = this;

  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/debug/', function (req, res) {

    //rewrite indexHTML page
    fs.writeFileSync((__dirname + "/web/index.html"), debug_self.returnIndexHTML(app), function(err) {
      if (err) {
        return console.log(err);
      }
    });
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/debug/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });


}




Debug.prototype.returnIndexHTML = function returnIndexHTML(app) {

return '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Online Demo</title> \
  <link rel="stylesheet" type="text/css" href="/server/style.css" /> \
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
      My Public Key: '+app.wallet.returnPublicKey()+' \
      <p></p> \
      Blockchain Info: \
      <p></p> \
      '+app.blockchain.debugHTML()+' \
    </div> \
\
</body> \
</html>';

}





