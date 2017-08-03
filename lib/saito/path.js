var saito    = require('../saito');




/////////////////
// CONSTRUCTOR //
/////////////////
function Path() {

  if (!(this instanceof Path)) {
    return new Path();
  }

  this.from = "";
  this.to   = "";
  this.sig  = "";

  return this;

}
module.exports = Path;


