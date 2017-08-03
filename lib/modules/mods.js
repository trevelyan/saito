


function Mods(app) {

  if (!(this instanceof Mods)) {
    return new Mods(app);
  }

  this.app     = app;
  this.mods    = [];

  return this;

}
module.exports = Mods




