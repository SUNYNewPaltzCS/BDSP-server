'use strict';

// Load Modules
let google = require( 'googleapis' );
let fs = require( 'fs' );
let OAuth2Client = google.auth.OAuth2;
let ft = google.fusiontables( 'v2' );
let user = google.oauth2( 'v2' );
let path = require( 'path' );

// Resolve file paths relative to this module
let clientSecrets = fs.readFileSync(
    path.join( __dirname, '..', 'private', 'client_secrets.json' ) );
let tokensFilepath = path.join( __dirname, '..', 'private', 'tokens.json' );
let tokensFile = fs.readFileSync( tokensFilepath );
let logsFilePath = path.join( __dirname, '..', 'internalServerError.log' );

// Client ID and client secret are available at
// https://code.google.com/apis/console
let client_secrets = JSON.parse( clientSecrets );
let CLIENT_ID = client_secrets.web.client_id;
let CLIENT_SECRET = client_secrets.web.client_secret;
let REDIRECT_URL = 'http://bd-sp.org:8080/node-builder/fusiontable/auth';

// Fusion table and user info scopes
let scopes = [
    'https://www.googleapis.com/auth/fusiontables',
    'https://www.googleapis.com/auth/userinfo.email'
];

// Site used for redirection once all authentication has been done
let site = 'http://bd-sp.org:8080/node-builder';

let oauth2Client = new OAuth2Client( CLIENT_ID, CLIENT_SECRET, REDIRECT_URL );
google.options( {
    auth: oauth2Client
} );


let fusiontables = {

    photoHandler: (req, res, next) => {
        console.log( req.file );
	console.log("%j", req.body.projectName);
        res.sendStatus( 200 );
    },

    blank: function () {
        return {};
    },
    /**
     * Updates the google fusion tables.
     * @param req {req.query.email} email of user owning the table
     * @param req {req.query.table} table name
     * @param req {req.body} contains an array of elements
     * @param res {object} response object
     * @param next {Function} next function to execute
     */
    updateFusionTables: (req, res, next) => {

        // Formulate error message
        let errorMessage = '';

        // Get body from req object
        let body = req.body;
        console.log( body );


        // If trying to update without passing any query parameters
        if ( Object.keys( req.query ).length === 0 ) {
            errorMessage = 'Trying to update to fusion tables without passing query parameters';
            return createErrorMessage( next, errorMessage );
        }

        // Retrieve Important URL Parameters
        let email = req.query.email;
        let table = req.query.table;

        // Read tokens from database
        let tokensJSON = readTokens();

        // Find the token with matching email
        let token = tokensJSON.find( matchingEmail );

        // Make sure token has a refresh token
        if ( token === null || token.refresh_token === null || token.access_token === null ) {
            errorMessage = 'Cannot upload to fusion tables. ' + email +
                ' does not have a valid refresh token.';
            return createErrorMessage( next, errorMessage );
        }

        // Set credentials to access fusion tables
        setCredentialsForFusionTable();

        // Get list of fusion tables
        getListOfTables( formatQueryForFusionTable );

        function matchingEmail(token) {
            return token.email === email;
        }

        function setCredentialsForFusionTable() {
            oauth2Client.setCredentials( {
                access_token: token.access_token,
                refresh_token: token.refresh_token
            } );
        }

        /**
         * Retrieves list of tables from fusion tables. It uses the credentials
         * set previously.
         * @param callback {Function} callback function to execute.
         */
        function getListOfTables(callback) {
            ft.table.list( {}, [], callback );
        }

        /**
         * Formats query for fusion table.
         * @param err {object} error object
         * @param profile {object} profile object.
         */
        function formatQueryForFusionTable(err, profile) {

            // If an error occurs while trying to get list of tables
            if ( err ) {
                errorMessage = 'Trying to get list of fusion tables.' + err.message;
                return createErrorMessage( next, errorMessage );
            }

            // Find the the table the user wants to upload information to
            // tableFound has property tableId later used
            let tableFound = findTableFromProfile( profile );

            // Make sure table is found
            if ( tableFound === null ) {
                errorMessage = 'Trying to access table this user has not access to.';
                return createErrorMessage( next, errorMessage );
            }

            // format/send query to fusion table
            sendQueryToFusionTable( tableFound, _ => res.sendStatus( 200 ) );
        }

        function findTableFromProfile(profile) {
            return profile.items.find( element => element.name === table );
        }

        /**
         * Sends query to fusion table.
         * @param table {object} table object retrieved from fusion table.
         * @param callback {Function} callback function to execute next
         * @return {*}
         */
        function sendQueryToFusionTable(table, callback) {
            body.forEach( function formatQuery(element) {
                if ( 'geometry' in element ) {
                    element.distance = kmlToDistance( element.geometry );
                }

                // INSERT INTO ${tableId} ('latitude', 'longitude', ...)
                // VALUES ('41.7403913', '-74.082381', ...)
                let query = `
                    INSERT INTO "${table.tableId}" (${Object.keys( element ).map( k => `'${k}'` )})
                    VALUES (${Object.keys( element ).map( k => `'${element[k]}'` )}) 
                `;

                // Make call to google fusion table rest api and update table
                ft.query.sql( { sql: query }, {}, err => {
                    if ( err ) {
                        errorMessage = 'Could not update to google fusion tables.';
                        return createErrorMessage( next, errorMessage );
                    }
                } );
            } );

            // call callback when done
            return callback();
        }

        function toRadians(degrees) {
            return degrees * Math.PI / 180;
        }

        function calcDistance(lon1, lat1, lon2, lat2) {
            lon1 = toRadians( lon1 );
            lat1 = toRadians( lat1 );
            lon2 = toRadians( lon2 );
            lat2 = toRadians( lat2 );

            let dlon = lon2 - lon1;
            let dlat = lat2 - lat1;

            let a = Math.pow( Math.sin( dlat / 2 ), 2 ) + Math.cos( lat1 ) * Math.cos( lat2 ) * Math.pow( Math.sin( dlon / 2 ), 2 );
            let c = 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) );

            let d = 3961 * c;

            return d;
        }

        function kmlToDistance(kmlStr) {
            let values = kmlStr.match( /<coordinates>(.*?)<\/coordinates>/ )[1].split( ' ' );
            let d = 0;

            if ( values[0] === null || values[0] === 'null' )
                return d;

            for ( let i = 0; i < values.length; i++ ) {
                values[i] += ',' + values.splice( i + 1, 1 )[0];
            }

            values.forEach( values => {
                values = values.split( ',' ).concat( values[1].split( ',' ) );
                let lon1 = parseFloat( values[0] );
                let lat1 = parseFloat( values[1] );
                let lon2 = parseFloat( values[2] );
                let lat2 = parseFloat( values[3] );

                d = d + calcDistance( lon1, lat1, lon2, lat2 );
            } );

            return d;
        }
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
        let tokensJSON = readTokens();

        // Let's assume user is not on database
        let exists = -1;

        // Check if user is in our database
        for ( let i = 0; i < tokensJSON.length; i++ ) {
            if ( email === tokensJSON[i].email ) {
                exists = i;
                break;
            }
        }

        // If user does not contain a refresh_token, it should possibly be in our database
        if ( user.refresh_token === undefined ) {

            // If it is in our database, refresh access_token
            if ( exists > -1 ) {
                tokensJSON[exists].access_token = user.access_token;
            }

            // otherwise, throw an error because we need refresh_token
            else {
                throw new Error
                ( 'User not found in our database, and refresh token not present.' +
                    ' Please revoke access to our app, and try again.' );
            }

            // Notify what hapened
            console.log( 'Refresh token for: ' + email );
            console.log( 'Access token: ' + tokens.access_token );
        }
        // if user does contain a refresh token, it should possibly be a new user
        else {
            if ( exists === -1 ) {
                tokensJSON.push( user );
            }

            // Notify what happened
            console.log( 'New token for: ' + email );
            console.log( 'Refresh token: ' + tokens.refresh_token );
            console.log( 'Access token: ' + tokens.access_token );
        }

        // Write the changes
        let options = { flag: 'w' };
        fs.writeFileSync( tokensFilepath, JSON.stringify( tokensJSON ), options, function (err) {
            if ( err ) throw err;
            console.log( 'File saved.' );
        } );
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

        fusiontables.get( (err, url) => {
            // Redirect page to google user consent page
            res.send( url );
        } );
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

	console.log(code)

        // Exhchange code for access token and refresh token
        oauth2Client.getToken( code, function (err, tokens) {

            // If error occurs
            if ( err ) {
                // handle the error correctly
                console.error( 'Could not exchange code for tokens.' );

                // abort
                return;
            }

            // set the credentials using them
            oauth2Client.setCredentials( tokens );

            // Obtain use email address
            user.userinfo.v2.me.get( 'email', function (err, email) {

                // Save email in sessions
                req.session.email = email.email;
                req.session.save();

                // Save tokens
                fusiontables.saveTokens( email.email, tokens );
            } );

            // Pull table info from fusion tables
            ft.table.list( {}, [], function (err, profile) {
                // if error occurs
                if ( err ) {
                    // handle the error correctly
                    console.error( 'Could not load data from fusion tables: ', err );

                    // Abort
                    return;
                }

                // Set user session and mark as logged in
                req.session.loggedIn = true;

                // Redirect browser to the home page
                res.writeHead( 301, { Location: site } );
                res.end();
            } );
        } );
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
        let url = oauth2Client.generateAuthUrl( {

            // 'online' (default) or 'offline' (gets refresh_token)
            access_type: 'offline',

            // Scopes defined access to specific google apis
            scope: scopes
        } );

        // Call the callback
        callback( null, url );
    },
    /**
     * Retrieves a list of tables a user owns.
     * Note: This function is defined as a express middleware function.
     * @param req the request object
     * @param res the response object
     */
    retrieveFusionTables: (req, res) => {
        // Check if the user is logged in
        if ( req.session.loggedIn ) {

            // Retrieve tables from user and send them to the client browser
            fusiontables.tables( req, function (err, rows) {
                res.send( rows );
            } );
        }

        // if user is not logged in
        else {
            // Properly handle the error
            fusiontables.get( _ => {
                res.send( 'NOT LOGGED IN' );
            } );
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
        user.userinfo.v2.me.get( 'email', function (err, email) {
            req.session.email = email.email;
        } );
        ft.table.list( {}, [], function (err, profile) {
            if ( err ) {
                console.log( 'An error occured : ', err.message );
            }
            ret( err, profile );
        } );
    }
};

module.exports = fusiontables;

function createErrorMessage(next, message) {
    fs.writeFile( logsFilePath, message, err => {
        if ( err ) {
            console.log( 'Error logging internal errors' );
        }

        return next( new Error( message ) );
    } );
}

function readTokens() {
    return JSON.parse( tokensFile );
}
