let fs = require('fs');
let path = require('path');
let rfs = require('rotating-file-stream');
let logger = require('morgan');

// Use the current timezone
logger.token('date', function() {
    var p = new Date().toString().replace(/[A-Z]{3}\+/,'+').split(/ /);
    return( p[2]+'/'+p[1]+'/'+p[3]+':'+p[4]+' '+p[5] );
});

/* Resolve log directory */
let logDirectory = path.join(__dirname, '../', 'log');

/* Ensure log directory exists */
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

/* Format string of predefined tokens */
let token = ':method :url :status :response-time ms :res[content-length] - :date[web]';

/* Correct date not being logged correctly */
logger.token('date', function() {
    let p = new Date().toString().replace(/[A-Z]{3}\+/,'+').split(/ /);
    return(p[4] + ' ' + p[0] + ', '+ p[2] + ' ' + p[1] + ' '+ p[3] + ' ' + p[5] );
});

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

module.exports.access = logger(token, { stream: accessLogStream });
module.exports.error = logger(token, {
    skip: (req, res) => res.statusCode < 400,
    stream: errorLogStream
});