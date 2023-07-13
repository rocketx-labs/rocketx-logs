Installation: 
```bash
npm i https://github.com/rocketx-labs/rocketx-logs.git
```

## Setting up:

### Setup S3 environment variables

```bash
AWS_ACCESS_KEY_ID = "";
AWS_SECRET_ACCESS_KEY = "";
```


### Setup in the index file of the app
```javascript
var logger = require('rocketx-logs');

// Args Info
/*
    app -> pass express APP variable
    path -> path to generate log files
    statuscodes -> takes array of response staus codes ... eg: [200, 400]
    rotatefileInterval -> interval to create new log files ..  eg: 1m, 1h, 5m
    uniquelogfoldername -> folder name to create on AWS -> machine name or env name
    s3bucketregion -> region of the s3 bucket
    logfilelocalretentiontime -> how long the log files created are kept locally
*/
logger.setup(app, path, statuscodes, rotatefileInterval, uniquelogfoldername, s3bucketregion, logfileloca,retentiontime);



// Example
logger.setup(app, __dirname + "/logs", [200, 404], "1m", "dev-staging", "ap-northeast-2", 10);
```

