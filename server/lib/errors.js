let fs = require('fs');
let path = require('path');

/* Resolve error file */
let errorFile = path.join(__dirname, '../', '../', 'public', '40x.html');

let error = {

    /* catch 404 and forward to error handler */
    'catch': function(req, res, next) {
        let err = new Error('Not Found');
        err.status = 404;
        next(err);
    },
    /* error handler */
    'handler': function(err, req, res, next) {
        // set locals, only providing error in development
        res.locals.message = err.message;
        res.locals.error = req.app.get('env') === 'development' ? err : {};

        // render the error page
        res.status(err.status || 500);

        // Ensure log directory exists
        if (fs.existsSync(errorFile)) {
            res.sendFile(errorFile);
        }
        else {
            res.send(err.message);
        }
    }
};

module.exports = error;