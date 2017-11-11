let express = require('express');
let parser = require('body-parser');
let googleapis = require('googleapis');
let client_secrets = require('./client_secrets.json');
let tokens = require('./private/tokens.json');
var OAuth2 = googleapis.auth.OAuth2;

let app = express();

app.use(parser.json());

let fusiontables = googleapis.fusiontables('v2');

var oauth2Client = new OAuth2(
    client_secrets.web.client_id,
    client_secrets.web.client_secret,
    client_secrets.web.redirect_uris
);

let scopes = ['https://www.googleapis.com/auth/fusiontables'];

// Retrieve tokens via token exchange explained above or set them:
oauth2Client.setCredentials({
    access_token: tokens[5].token,
    //refresh_token: tokens[0].refresh_token
    // Optional, provide an expiry_date (milliseconds since the Unix Epoch)
    // expiry_date: (new Date()).getTime() + (1000 * 60 * 60 * 24 * 7)
});

fusiontables.table.list({
    auth: oauth2Client
}, function (err, res) {
    if (err) throw err;
    console.log(res);

});

app.listen(8000, () => console.log('Listenning on port 8000'));