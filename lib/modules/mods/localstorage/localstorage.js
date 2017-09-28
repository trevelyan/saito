var saito       = require('../../../saito');
var ModTemplate = require('../../template');
var util        = require('util');
var fs          = require('fs');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Localstorage(app) {

  if (!(this instanceof Localstorage)) { return new Localstorage(app); }
  Localstorage.super_.call(this);

  this.app             = app;
  this.name            = "Localstorage";

  return this;

}
module.exports = Localstorage;
util.inherits(Localstorage, ModTemplate);





/////////////////////////
// Handle Web Requests //
/////////////////////////
Localstorage.prototype.webServer = function webServer(app, expressapp) {

  var localstorage_self = this;

  ///////////////////
  // web resources //
  ///////////////////
  expressapp.get('/localstorage/', function (req, res) {
    //rewrite indexHTML page
    fs.writeFileSync((__dirname + "/web/index.html"), localstorage_self.returnIndexHTML(app), function(err) {
      if (err) {
        return console.log(err);
      }
    });
    res.sendFile(__dirname + '/web/index.html');
    return;
  });
  expressapp.get('/localstorage/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });

}




Localstorage.prototype.returnIndexHTML = function returnIndexHTML(app) {

return '<html> \
<head> \
  <meta charset="utf-8"> \
  <meta http-equiv="X-UA-Compatible" content="IE=edge"> \
  <meta name="viewport" content="width=device-width, initial-scale=1"> \
  <meta name="description" content=""> \
  <meta name="author" content=""> \
  <title>Saito Network: Blockchain Explorer</title> \
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
      Browser Information \
      <code><pre> \
'+JSON.stringify(app.options, null, 4)+' \
      </pre></code> \
      <p></p>Wallet Information \
      <code><pre> \
'+JSON.stringify(app.wallet.wallet, null, 4)+' \
      </pre></code> \
    </div> \
\
</body> \
</html>';

}


