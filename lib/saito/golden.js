var saito         = require('../saito');


function GoldenTicket(gtjson="") {

  if (!(this instanceof GoldenTicket)) {
    return new GoldenTicket(gtjson);
  }


  if (txjson != "") {
    this.transaction = JSON.parse(gtjson);
  }

  return this;

}
module.exports = GoldenTicket;





