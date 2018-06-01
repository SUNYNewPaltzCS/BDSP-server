// Load Modules
let express = require( 'express' );
let fs = require( 'fs' );
let session = require( 'express-session' );
let path = require( 'path' );
let multer = require( 'multer' );

const storage = multer.diskStorage( {
    destination: (req, file, next) => {
        next( null, 'uploads' );
    },
    filename: (req, file, next) => {
        next( null, file.originalname );
    }
} );
const upload = multer( { storage: storage } );

// Load User Defined Modules
let fusiontable = require( './model/fusiontable.js' );
let build = require( './model/build.js' );

// Express Router
let app = express.Router();

// Boiler Plate Middleware
app.use( express.static( path.join( __dirname, '/public' ) ) );
app.use( session( {
    secret: 'Ralph The Turtle',
    resave: true,
    saveUninitialized: true,
} ) );

// Fusion Table Middleware
app.get( '/fusiontable', fusiontable.generateUserConsentUrl )
    .get( '/fusiontable/auth', fusiontable.oauthCallback )
    .get( '/fusiontable/table', fusiontable.retrieveFusionTables )
    .post( '/fusiontable/update.php', fusiontable.updateFusionTables )
    .post( '/photohandler', upload.single( 'photo' ), fusiontable.photoHandler )

    // Build App Middleware
    .get( '/downloads/:file', function (req, res) {
        let file = req.params.file;
        let dl = fs.readFileSync( 'node-builder/public/downloads/' + file );
        res.end( dl, 'binary' );
    } )
    .post( '/build', function (req, res) {
        build.post( req, function (err, response) {
            res.send( response );
        } );
    } );

// Export Router app
module.exports = app;
