
var request = require("request");


    // fetch the latest data from our server
    var url = "http://localhost:12100/registry/addresses.txt";
    try {
      request.get(url, (error, response, body) => {


        var lines = body.match(/^.*([\n\r]+|$)/gm);

        for (var m = 0; m < lines.length; m++) {
	  if (lines[m] != "") {
            console.log("--->" + lines[m]+ "<----");
	  }
        }

      });
    } catch (err) {}



