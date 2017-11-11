// Copyright 2012-2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

// Load Modules
let google = require('googleapis');
let fs = require("fs");
let OAuth2Client = google.auth.OAuth2;
let ft = google.fusiontables('v2');
let user = google.oauth2('v2');
let path = require('path');

// Resolve file paths relative to this module
let clientSecrets = fs.readFileSync(
    path.join(__dirname, '..', 'client_secrets.json'));
let tokensFilepath = path.join(__dirname, '..', 'private', 'tokens.json');
let tokensOnFile = fs.readFileSync(tokensFilepath);

// Client ID and client secret are available at
// https://code.google.com/apis/console
let client_secrets = JSON.parse(clientSecrets);
let CLIENT_ID = client_secrets.web.client_id;
let CLIENT_SECRET = client_secrets.web.client_secret;
let REDIRECT_URL = 'http://localhost:3000/node-builder/fusiontable/auth';

// Fusion table and user info scopes
let scopes = [
    'https://www.googleapis.com/auth/fusiontables',
    'https://www.googleapis.com/auth/userinfo.email'
];

// Site used for redirection once all authentication has been done
let site = "http://localhost:3000/node-builder";

let oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
google.options({
    auth: oauth2Client
});


let fusiontables = {
    blank: function () {
        return {};
    },
    /**
     * Properly save tokens into a tokensFilepath defined above.
     * @param email the email of the user.
     * @param tokens the tokens object needed.
     */
    saveTokens: (email, tokens) => {

        // Represent tokens as a user
        let user = {
            email: email,
            refresh_token: tokens.refresh_token,
            access_token: tokens.access_token
        };

        // Read tokens from database
        let tokensFile = JSON.parse(tokensOnFile);

        // Let's assume user is not on database
        let exists = -1;

        // Check if user is in our database
        for (var i = 0; i < tokensFile.length; i++) {
            if (email === tokensFile[i].email) {
                exists = i;
                break;
            }
        }

        // If user does not contain a refresh_token, it should possibly be in our database
        if (user.refresh_token === undefined) {

            // If it is in our database, refresh access_token
            if (exists > -1 ) { tokensFile[exists].access_token = user.access_token }

            // otherwise, throw an error because we need refresh_token
            else { throw new Error
            ('User not found in our database, and refresh token not present.' +
                ' Please revoke access to our app, and try again.') }

            // Notify what hapened
            console.log('Refresh token for: ' + email);
            console.log('Access token: ' + tokens.access_token);
        }
        // if user does contain a refresh token, it should possibly be a new user
        else {
            if (exists === -1) { tokensFile.push(user); }

            // Notify what happened
            console.log('New token for: ' + email);
            console.log('Refresh token: ' + tokens.refresh_token);
            console.log('Access token: ' + tokens.access_token);
        }

        // Write the changes
        let options = {flag: 'w'};
        fs.writeFileSync(tokensFilepath, JSON.stringify(tokensFile), options, function (err) {
            if (err) throw err;
            console.log('File saved.');
        });
    },
    /**
     * Generates a user consent url and redirects the user browser to the
     * generated url. The generated url is where the user grants consent to
     * our app.
     * Note: It uses the get function defined below.
     * Note: This function is defined as a express middleware function.
     * @param req the request object
     * @param res the response object
     */
    generateUserConsentUrl: (req, res) => {

        fusiontables.get((err, url) => {
            // Redirect page to google user consent page
            res.send(url);
        });
    },
    /**
     * Contains the logic required to handle what happens when the user has
     * giving consent to our app and google servers have returned a code.
     * Once the code is obtained, we can exchange it for a tokens object that
     * contains a refresh_token and a access_token. We can set the credentials
     * for our oauth2 client using the tokens object. Later, we can retrieve
     * the user email and a list of tables. Finally, we redirect the user browser
     * to the home page "/node-builder".
     * Note: This function is defined as a express middleware function.
     * @param req the request object
     * @param res the response object
     */
    oauthCallback: (req, res) => {
        // Retrieve code from google server to exchange for tokens
        let code = req.query.code;

        // Exhchange code for access token and refresh token
        oauth2Client.getToken(code, function (err, tokens) {

            // If error occurs
            if (err) {
                // handle the error correctly
                console.error('Could not exchange code for tokens.');

                // abort
                return;
            }

            // set the credentials using them
            oauth2Client.setCredentials(tokens);

            // Obtain use email address
            user.userinfo.v2.me.get('email', function (err, email) {

                // Save email in sessions
                req.session.email = email.email;
                req.session.save();

                // Save tokens
                fusiontables.saveTokens(email.email, tokens)
            });

            // Pull table info from fusion tables
            ft.table.list({}, [], function (err, profile) {
                // if error occurs
                if (err) {
                    // handle the error correctly
                    console.error('Could not load data from fusion tables: ', err);

                    // Abort
                    return;
                }

                // Set user session and mark as logged in
                req.session.loggedIn = true;

                // Redirect browser to the home page
                res.writeHead(301, { Location: site });
                res.end();
            });
        });
    },
    /**
     * Generates a user consent url using the scopes variable at the top.
     * The scopes ask permissions to access the fusiontable api and the user
     * info. Once the user consent url is generated, we redirect the user
     * to this consent page, so they may grant permission to our app.
     * Note: The scopes are hardcoded at the top of this module.
     * @param callback callback function with signature
     *  (err, url) => {} where url contains that generated url where a user
     *  can grant consent to the app.
     */
    get: (callback) => {

        // Generates a url that asks permissions for fusiontables and userinfo scopes
        let url = oauth2Client.generateAuthUrl({

            // 'online' (default) or 'offline' (gets refresh_token)
            access_type: 'offline',

            // Scopes defined access to specific google apis
            scope: scopes
        });

        // Call the callback
        callback(null, url);
    },
    /**
     * Retrieves a list of tables a user owns.
     * Note: This function is defined as a express middleware function.
     * @param req the request object
     * @param res the response object
     */
    retrieveFusionTables: (req, res) => {
        // Check if the user is logged in
        if (req.session.loggedIn) {

            // Retrieve tables from user and send them to the client browser
            fusiontables.tables(req, function(err, rows) {
                res.send(rows);
            });
        }

        // if user is not logged in
        else {
            // Properly handle the error
            fusiontables.get( _ => {
                res.send("NOT LOGGED IN");
            });
        }
    },
    /**
     * Retrieves a list of tables a user owns. It also contains logic for
     * checking if a user has been logged in or not.
     * Note: This function is defined as a express middleware function.
     * @param req the request object
     * @param res the response object
     */
    tables: (req, ret) => {
        user.userinfo.v2.me.get('email', function (err, email) {
            req.session.email = email.email;
        });
        ft.table.list({}, [], function (err, profile) {
            if (err) {
                console.log('An error occured : ', err.message);
            }
            ret(err, profile);
        });
    }
};

module.exports = fusiontables;