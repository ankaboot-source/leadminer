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
const app = express();
const http = require("http");
const logger = require("./app/utils/logger")(module);
const SSE = require("express-sse").SSE;
let redis = require("./redis");
const sse = new SSE();
const server = http.createServer(app);
const db = require("./app/models");
const PORT = process.env.PORT || 8081;
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
redis.connect();

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
    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}.`);
    });
  })
  .catch((error) => {
    logger.debug("can't initialize database ✖️ ");
    logger.error(error);
    process.exit();
  });

module.exports = server;
