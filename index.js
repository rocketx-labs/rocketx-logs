var morgan = require('morgan');
var rfs = require('rotating-file-stream')
var uuid = require("uuid");
var fs = require("fs");
const Writable = require("stream").Writable;
const path = require("path");
const util = require('util');
const recursive = require("recursive-readdir");
const fse = require("fs-extra");


const { S3Client } = require('@aws-sdk/client-s3');
const { S3SyncClient } = require('s3-sync-client');


//helper functions
function assignId(req, res, next) {
    req.unique_request_id = uuid.v4();
    next();
}

//file name generators
const pad = num => (num > 9 ? "" : "0") + num;
const generator = (filename, loggingRotatePath) => {

    return function(time, index) {
        if (!time) return filename;

        var year = time.getFullYear();
        var month = pad(time.getMonth() + 1);
        var day = pad(time.getDate());
        var hour = pad(time.getHours());
        var minute = pad(time.getMinutes());
      
        return `${loggingRotatePath}/${year}/${month}/${day}/${year}${month}${day}-${hour}${minute}-${index}-${filename}`;
    }

};


module.exports = {

    // pass express app, path to store logs
    //logFileLocalRetentionTime in minutes eg: 1, 10, 24*60
    // fileRotateInterval in time format eg: 1m, 10m, 10h
    setup: async function (app, logpath, responseStatus=[], fileRotateInterval, s3Path, s3Region, logFileLocalRetentionTime) {
        
        //assign uniq id to request
        app.use(assignId);

        //logging
        for(let i = 0; i <= responseStatus.length; i++) {
            let statusCode = "Others";
            if(i != responseStatus.length) {
                statusCode = responseStatus[i];
            }

            // create a rotating write stream
            let logStream = rfs.createStream( generator(statusCode + '.log', "request-logs"), {
                interval: fileRotateInterval,
                path: logpath
            });

            let logStreamWriter = new (class LogStream extends Writable {
                write(data) {
                    logStream.write(data);
                }
            })()

            let skipFunction = function(req, res) { 
                return (responseStatus.indexOf(res.statusCode) != -1) 
            }

            if(i != responseStatus.length) {
                skipFunction = function (req, res) { return res.statusCode != statusCode };
            }

            app.use(morgan(function (tokens, req, res) {
                return JSON.stringify({
                    request_id: req.unique_request_id,
                    remote_addr: tokens["remote-addr"](req, res),
                    date_iso: tokens["date"](req, res, "iso"),
                    method: tokens.method(req, res),
                    url: tokens.url(req, res),
                    status: tokens.status(req, res),
                    responseTime: tokens['response-time'](req, res) + "ms",
                    body: req.body,
                    query: req.query,
                    user_agent: tokens["user-agent"](req, res)
                });
            }, { stream: logStreamWriter, skip: skipFunction}));

        }



        //logging console logs
        let consolelogStream = rfs.createStream( generator("console.log", "console-logs"), {
            interval: fileRotateInterval, 
            path: logpath
        });

        let errorlogStream = rfs.createStream( generator('error.log', "error-logs"), {
            interval: fileRotateInterval,
            path: logpath
        });

        let logStdout = process.stdout;

        console.log = function () {
            consolelogStream.write(util.format.apply(null, arguments) + '\n');
            logStdout.write(util.format.apply(null, arguments) + '\n');
        }
        console.error = function () {
            errorlogStream.write(util.format.apply(null, arguments) + '\n');
            logStdout.write(util.format.apply(null, arguments) + '\n');
        }



        //AWS SYNC
        const s3Client = new S3Client({ region: s3Region });
        const s3Sync = new S3SyncClient({ client: s3Client });


        setInterval(async () => {
            try {
                let status = await s3Sync.sync(logpath, `s3://rocketx-logs/${s3Path}`);
                let files = await recursive(logpath);
                let now = new Date();
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];

                    let stat = fse.statSync(file);
                    let diff = ((now - stat.mtimeMs)/1000)/60;

                    if(diff > logFileLocalRetentionTime) {
                        //delete file
                        fse.removeSync(file);
                    }
                    
                }
                
            } catch (err) {
                console.log(err);
            }
        }, 60 * 1 * 1000);

    }

}
