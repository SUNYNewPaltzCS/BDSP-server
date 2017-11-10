let fs = require('fs');
let path = require('path');
let rfs = require('rotating-file-stream');
let logger = require('morgan');

/* Resolve log directory */
let logDirectory = path.join(__dirname, '../', 'log');

/* Ensure log directory exists */
fs.exists(logDirectory || fs.mkdirSync(logDirectory));

/* Create access log for each day */
let accessLogStream = rfs('access.log', {
    interval: '1d', // rotate daily
    path: logDirectory
});

/* Create error log for each day */
let errorLogStream = rfs('error.log', {
    interval: '1d',
    path: logDirectory
});

module.exports.access = logger('combined', { stream: accessLogStream });
module.exports.error = logger('combined', {
    skip: (req, res) => res.statusCode < 400,
    stream: errorLogStream
});