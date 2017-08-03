var saito = require('../saito');




function Browser(app) {

  if (!(this instanceof Browser)) {
    return new Browser(app);
  }

  this.app = app || {};

}
module.exports = Browser;


