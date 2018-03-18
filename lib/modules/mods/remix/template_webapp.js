

/////////////////////
// Web Application //
/////////////////////
//
// This function is run the first time a browser loads the HTML content 
// in your Saito application. It is run on whatever computer is VIEWING 
// the web-app (i.e. not the server that has fed out the javascript file).
//
// You can use it to add default content to the DOM. In this case, we just
// edit one of the items on the page to show us our Saito address. This 
// can be counterintuitive, because while it SEEMS that we are fetching the 
// webpage from a remote server (which is serving up the javascript) we are
// in fact loading it from our own computer.
//
// If you want to add older messages to your application (i.e. email or 
// twitter client), you can fetch them from the app.archives function. And
// add them to the interface one-by-one. Check out our email application for 
// an example of how to handle this.
//
RemixApp.prototype.initializeHTML = function initializeHTML(app) {

    $('#saito_address').html(app.wallet.returnPublicKey());

}
//
// This callback allows us to attach events and interactivity to the 
// elements in our HTML page. It is run in the browser of the user who is
// engaging with the application.
//
// We keep this function separate from "initializeHTML" as this way we can 
// call this again-and-again to refresh the DOM events without the need to 
// re-initialize the entire webpage.
//
RemixApp.prototype.attachEvents = function attachEvents(app) {

    $('#saito_button').off();
    $('#saito_button').on('click', function() {
      alert("You clicked the button");
    });

};



