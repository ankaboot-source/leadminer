const express = require("express");
require("dotenv").config();
console.log(
  `%c
    ██╗     ███████╗ █████╗ ██████╗ ███╗   ███╗██╗███╗   ██╗███████╗██████╗ 
    ██║     ██╔════╝██╔══██╗██╔══██╗████╗ ████║██║████╗  ██║██╔════╝██╔══██╗
    ██║     █████╗  ███████║██║  ██║██╔████╔██║██║██╔██╗ ██║█████╗  ██████╔╝
    ██║     ██╔══╝  ██╔══██║██║  ██║██║╚██╔╝██║██║██║╚██╗██║██╔══╝  ██╔══██╗
    ███████╗███████╗██║  ██║██████╔╝██║ ╚═╝ ██║██║██║ ╚████║███████╗██║  ██║
    ╚══════╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝
`,
  `font-family: monospace`
);
const config = require("config");
const port = config.get("server.port");
const app = express();
const http = require("http");
const SSE = require("express-sse").SSE;
const Redis = require("./redis");
const logger = require("./app/utils/logger")(module);

const sse = new SSE();
const db = require("./app/models");
const { EventEmitter } = require("stream");
const server = http.createServer(app);
class MyEmitter extends EventEmitter {}
const Sentry = require("@sentry/node");
// or use es6 import statements
// import * as Sentry from '@sentry/node';

const Tracing = require("@sentry/tracing");
// or use es6 import statements
// import * as Tracing from '@sentry/tracing';
let appli = app;
Sentry.init({
  dsn: "https://d383400104b243a489c54831d4947f00@o1383368.ingest.sentry.io/6699794",
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ appli }),
  ],
  tracesSampleRate: 1.0,
  tracesSampler: (samplingContext) => {
    // sample out transactions from http OPTIONS requests hitting endpoints
    const request = samplingContext.request;
    if (request && request.method == "OPTIONS") {
      return 0.0;
    } else {
      return 1.0;
    }
  },
});
const transaction = Sentry.startTransaction({
  op: "transaction",
  name: "My Transaction",
});

// Note that we set the transaction as the span on the scope.
// This step makes sure that if an error happens during the lifetime of the transaction
// the transaction context will be attached to the error event
Sentry.configureScope((scope) => {
  scope.setSpan(transaction);
});
// The Sentry request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

const event = new MyEmitter();
app.use((req, res, next) => {
  // Website you wish to allow to connect
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Request methods you wish to allow
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  // Request headers you wish to allow
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader("Access-Control-Allow-Credentials", true);
  // Pass to next layer of middleware
  next();
});

// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
// step 1 : connect to redis
//redisClient.connect();

// simple route when calling api.leadminer.io
app.get("/", (req, res) => {
  res.json({ message: "Welcome to leadminer application." });
});
// attach sse to api/stream endpoint
app.get("/api/stream/", sse.init);
app.get("/logs", function (req, res, next) {
  var filePath = __dirname + "/logs/server.log";

  res.sendFile(filePath, function (err) {
    /* istanbul ignore if */
    if (err) {
      next(err);
    } else {
      console.log("Sent the logs..");
    }
  });
});
// The io instance is set in Express so it can be grabbed in a route
require("./app/routes/imap.routes")(app, sse);
db.sequelize
  .sync()
  .then(() => {
    logger.debug("database initialized ✔️ ");
    // if successful init then start server
    server.listen(port, () => {
      logger.info(`Server is running port ${port}.`);
      event.emit("started");
    });
    server.on("error", (e) => {
      if (e.code === "EADDRINUSE") {
        console.debug("Address in use, retrying...");
      }
    });
  })
  .catch((error) => {
    logger.debug("can't initialize database ✖️ ");
    console.log(error);
    logger.error(error);
    process.exit();
  });
server.emit("app_started", true);

function stop() {
  server.close();
}
module.exports = { server, stop, event };
