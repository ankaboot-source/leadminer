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
var app = express();
const http = require("http");
const SSE = require("express-sse").SSE;
const sentry = require("./sentry");
const logger = require("./app/utils/logger")(module);
const sse = new SSE();
const db = require("./app/models");
const { EventEmitter } = require("stream");
const server = http.createServer(app);
class MyEmitter extends EventEmitter {}
const event = new MyEmitter();
const redisClientForInitialisation =
  require("./redis").redisClientForInitialConnection();

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
if (config.get("server.sentry.enabled") == true) {
  logger.debug("setting up sentry...");
  integration = sentry(app);
  app = integration[0];
  const sentryInstance = integration[1];
  logger.debug("sentry integrated to the server ✔️ ");
}
// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// simple route when calling api.leadminer.io
app.get("/", (req, res) => {
  res.json({ message: "Welcome to leadminer application." });
});
// attach sse to api/stream endpoint
app.get("/api/stream", sse.init);
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
    //disconnect from redis after initialization
    redisClientForInitialisation.disconnect();
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
