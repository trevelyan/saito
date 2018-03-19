var saito = require('./../../../saito');
var ModTemplate = require('../../template');
var util = require('util');
var fs = require('fs');
var shell = require('shelljs');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Remix(app) {

  if (!(this instanceof Remix)) { return new Remix(app); }

  Remix.super_.call(this);

  this.app             = app;

  this.name            = "Remix";
  this.browser_active  = 0;
  this.handlesEmail    = 0;

  this.remix_module_name = "RemixApp";
  this.module_name     = "";

  return this;

}
module.exports = Remix;
util.inherits(Remix, ModTemplate);








/////////////////////////
// Handle Web Requests //
/////////////////////////
Remix.prototype.webServer = function webServer(app, expressapp) {

  var remix_self = this;

  expressapp.get('/remix/', function (req, res) {
    if (req.query.saito_address == null) {
      res.sendFile(__dirname + '/web/index.html');
      return;
    }
  });
  expressapp.get('/remix/template.js', function (req, res) {
    res.sendFile(__dirname + '/template.js');
    return;
  });
  expressapp.get('/remix/template_email.js', function (req, res) {
    res.sendFile(__dirname + '/template_email.js');
    return;
  });
  expressapp.get('/remix/template_webapp.js', function (req, res) {
    res.sendFile(__dirname + '/template_webapp.js');
    return;
  });
  expressapp.get('/remix/template.html', function (req, res) {
    res.sendFile(__dirname + '/template.html');
    return;
  });
  expressapp.get('/remix/cache/:cachedfile', function (req, res) {
    var cachedfile = '/web/cache/'+req.params.cachedfile;
    if (cachedfile.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + cachedfile);
    return;
  });
  expressapp.get('/remix/cache/html/:cachedfile', function (req, res) {
    var cachedfile = '/web/cache/html/'+req.params.cachedfile;
    if (cachedfile.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + cachedfile);
    return;
  });
  expressapp.get('/remix/cache/js/:cachedfile', function (req, res) {
    var cachedfile = '/web/cache/js/'+req.params.cachedfile;
    if (cachedfile.indexOf("\/") != false) { return; }
    res.sendFile(__dirname + cachedfile);
    return;
  });
  expressapp.get('/remix/style.css', function (req, res) {
    res.sendFile(__dirname + '/web/style.css');
    return;
  });
  expressapp.post('/remix/submit', function (req, res) {

    var unique_no  = Math.random().toString().substring(2, 15);
    var unique_js  = unique_no + '.js';
    var browser_js = unique_no + '-browser.js';
    var unique_ht  = unique_no + '.html';

    var codefile = req.body.code;
    var htmlfile = req.body.html;
    this.remix_module_name = req.body.remix_module_name;

    var codefilename   = __dirname + '/web/cache/js/'+unique_no+'.js';
    var jstemplate     = __dirname + '/mods_template.js';
    var js_temp_mod    = '../../mods/remix/web/cache/js/' + unique_js;
    var js_compile     = __dirname + '/mods.js';
    var htmltemplate   = __dirname + '/web/cache/template.html';
    var htmledited     = __dirname + '/web/cache/html/' + unique_no + '.html';
    var htmlappedited  = __dirname + '/web/cache/html/' + unique_no + '-app.html';
    var htmllink       = '<html><body>We have compiled your application into a Saito module.<p></p>Click on one of the following links to test it:<p></p><a target="_email" href="/remix/cache/html/'+unique_ht+'">Saito email application</a><p></p><a target="_html" href="/remix/cache/html/'+unique_no+'-app.html">Saito web application</a><p></p>To test your module on the live network, just share the URL of these pages.<p></p>Please note: if you do not have tokens in your browser, you should visit our <a href="/faucet" target="_faucet">token faucet</a> before loading these pages.</body></html>';
    var compile_script = __dirname + '/compile_user_mod';


    // update HTML
    htmlfile = htmlfile.replace(/browser.js/g, browser_js);

/*** 
    var jsstuff = ' \
RemixApp.prototype.webServer = function webServer(app, expressapp) { \
  var remix_self = this; \
  expressapp.get(\'/remix/cache/html/APP_HTML_FILENAME/\', function (req, res) { \
    res.sendFile(__dirname + \'/web/cache/html/\' + "APP_HTML_FILENAME"); \
    return; \
  }); \
} \
    ';
    jsstuff         = jsstuff.replace("RemixApp", this.remix_module_name);
    var tmpfilename = unique_no + '-app.html';
    jsstuff         = jsstuff.replace(/APP_HTML_FILENAME/g, tmpfilename);
    codefile       += jsstuff;
***/

    fs.writeFileSync(codefilename, codefile, 'binary');
    fs.writeFileSync(htmlappedited, htmlfile, 'binary');


    // read mods_template file we will edit
    fs.readFile(jstemplate, {encoding: 'utf-8'}, function(err, jsdata) {

      // edit and save mods.js we will compile
      jsdata      = jsdata.replace(/PATH_TO_USER_MODULE/g, js_temp_mod);
      tmpfilename = unique_no + '-app.html';
      jsdata      = jsdata.replace(/APP_HTML_FILENAME/g, tmpfilename);
      fs.writeFile(js_compile, jsdata, function(err) {

        if (shell.exec(compile_script).code !== 0) {
          shell.echo('Error: Git commit failed');
          shell.exit(1);
        } else {

	  // move browser.js into custom position
	  var move_script = "mv '" + __dirname + '/web/cache/browser.js' + "' '" + __dirname + '/web/cache/js/' + browser_js + "'"; 
          if (shell.exec(move_script).code !== 0) {
	  } else {

  	    // read HTML file users get
            fs.readFile(htmltemplate, {encoding: 'utf-8'}, function(err,data) {

              // edit and save
              data = data.replace(/browser.js/g, browser_js);
              fs.writeFile(htmledited, data, function(err) {
                res.write(htmllink);
                res.end();
              });
            });
	  }
	}
      });
    });
  });

}





/////////////
// On Load //
/////////////
Remix.prototype.initializeHTML = function initializeHTML(app) {}


///////////////////
// Attach Events //
///////////////////
Remix.prototype.attachEvents = function attachEvents(app) {

  var remix_self = this;

  if (app.BROWSER == 0) { return; }

  $('#js_menu').off();
  $('#js_menu').on('click', function() {
    $('#html').hide();
    $('#code').show();
    $('#code').focus();
  });

  $('#html_menu').off();
  $('#html_menu').on('click', function() {
    $('#code').hide();
    $('#html').show();
    $('#html').focus();
  });


  $('#new_module_button').off();
  $('#new_module_button').on('click', function() {

    remix_self.module_name = "";
    while (remix_self.module_name == "") {
      remix_self.module_name = prompt("Please name this module:", "NewModule");
    }
    $('#remix_module_name').val(remix_self.module_name);

    // load templates
    $.get( "/remix/template.js", function( data ) {
      remix_self.module_name = remix_self.module_name.replace(/\W/g, '');
      data = data.replace(/RemixApp/g, remix_self.module_name);
      $("#code").val(data);
      $("#code").focus();
    });
    $.get( "/remix/template.html", function( data ) {
      remix_self.module_name = remix_self.module_name.replace(/\W/g, '');
      data = data.replace(/RemixApp/g, remix_self.module_name);
      $("#html").val(data);
    });

    $('#new_module_button').hide();
    $('#ide_instructions').show();
    $('#editor').show();

  });

  

  $('#new_module_email_callbacks').off();
  $('#new_module_email_callbacks').on('click', function() {
    $.get( "/remix/template_email.js", function( data ) {
      data = data.replace(/RemixApp/g, remix_self.module_name);
      $("#code").val($("#code").val() + data);
      $("#code").focus();
      $('#new_module_email_callbacks').hide();

      $("#code").val( $("#code").val().replace("  return this;", "  this.handlesEmail = 1;\n  this.emailAppName = \"New Application\";\n  return this;"));

    });
  });



  $('#new_module_webapp_callbacks').off();
  $('#new_module_webapp_callbacks').on('click', function() {
    $.get( "/remix/template_webapp.js", function( data ) {
      data = data.replace(/RemixApp/g, remix_self.module_name);
      $("#code").val($("#code").val() + data);
      $("#code").focus();
      $('#new_module_webapp_callbacks').hide();
      $('#html_menu').show();
    });
  });

  $('#remix_submit').off();
  $('#remix_submit').on('click', function() {
    var user_code = $('.code').val();
  });

}









