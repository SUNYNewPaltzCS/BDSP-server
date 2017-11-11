// Load Modules
let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');

// Load User Defined Middleware
let logger = require('./lib/logger');
let err = require('./lib/errors');

// Load Routers
let index = require('./routes/index');
let nodeBuilder = require('./routes/nodeBuilder');

// Express app
let app = express();

// Boiler Plate Middleware
app.use(logger.access);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// User defined middleware Routes
app.use('/', index);
app.use('/node-builder', nodeBuilder);

// Error Logging, catching, and handling
app.use(logger.error);
app.use(err.catch);
app.use(err.handler);

module.exports = app;