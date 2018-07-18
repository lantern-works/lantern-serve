/**
* Lantern HTTP Server
*
* We serve web applications and the PouchDB at the same origin.
* This allows easy access to the database through javascript.
* Useful for hosting on a Raspberry Pi or cloud environment.
*
**/
var uuid = require("uuid");
var http = require("http");
var https = require("https");
var path = require("path");
var fs = require("fs");
var bodyParser = require("body-parser");
var express = require("express");
var compression = require("compression");
var index = require("./index");
var serv, http_port, https_port;


// @todo handle in-full the PouchDB leaflet / first certificate errors
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

//----------------------------------------------------------------------------
function onServerStarted(host_id) {

    console.log("##############################################");
    console.log(" Lantern App Server (" + host_id + ")");
    console.log("##############################################");

    var db = new index.PouchDB("https://localhost/db/lantern");
    
    /*
    * Set up lantern database bucket
    */
    db.info()
        .then(function(response) {
            console.log("[db] starting doc count: " + response.doc_count);
            console.log("[db] update sequence: " + response.update_seq);


        var maps_db = new index.PouchDB("https://localhost/db/lantern-maps");
        maps_db.info();
        
    })
    .catch(function(err) {
        console.log(err);
        throw new Error(err);
    });
}



//----------------------------------------------------------------------------
/*
* Set up application server and routing
*/
serv = express();
serv.disable("x-powered-by");
serv.use(compression());
serv.use(bodyParser.json());

/*
* Auto-load middleware
*/
var middleware_files = fs.readdirSync("./middleware");
middleware_files.forEach(function(file)  {
    console.log("[middleware] " + file);
    serv.use(require("./middleware/" + file));
});

/*
* Auto-load routes
*/
var route_files = fs.readdirSync("./routes");
route_files.forEach(function(file) {
    console.log("[route] " + file);
    require("./routes/" + file)(serv);
});

/*
* Check for additional routes (e.g. device-specific controls)
*/
if (fs.existsSync("../../routes")) {
    var extra_route_files = fs.readdirSync("../../routes");
    extra_route_files.forEach(function(file) {        
        console.log("[route] " + file);
        require("../../routes/" + file)(serv);
    });   
}

/*
* Final routes are for any static pages and binary files
*/
var static_path = path.resolve(__dirname + "/public/");
serv.use("/", express.static(static_path));

/*
* Unpack latest static web assets
*/
index.WebUpdate();

//----------------------------------------------------------------------------
/*
* Start web server
*/
http_port = (process.env.TERM_PROGRAM ? 8080 : 80);
https_port = (process.env.TERM_PROGRAM ? 8443 : 443);
var private_key  = fs.readFileSync('/opt/lantern/sslcert/privkey1.pem', 'utf8');
var certificate = fs.readFileSync('/opt/lantern/sslcert/cert1.pem', 'utf8');
var credentials = {key: private_key, cert: certificate};
var httpServer = http.createServer(serv);
var httpsServer = https.createServer(credentials, serv);


var config_file_path = path.join("config.json");
var obj = JSON.parse(fs.readFileSync(config_file_path, "utf8"));
if (!obj.id || typeof(obj.id) != "string" || obj.id.length != 3) {
    obj.id = uuid.v4();

    if (!obj.name) {
        obj.name = obj.id.substr(0, 3);
    }

    fs.writeFileSync(config_file_path, JSON.stringify(obj), "utf8");
}

httpsServer.listen(https_port, function() {
    httpServer.listen(http_port, function() {
        onServerStarted(obj.id);
    });
});