


function ModTemplate(app) {

  if (!(this instanceof ModTemplate)) {
    return new ModTemplate(app);
  }

  this.app             = app || {};

  this.name = "";

  return this;

}
module.exports = ModTemplate





