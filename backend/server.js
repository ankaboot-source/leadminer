const express = require("express");
require("dotenv").config();
const app = express();
const http = require("http");
const logger = require("./app/utils/logger")(module);
const SSE = require("express-sse").SSE;
const redis = require("redis");
// initialise sse (server sent events)
const sse = new SSE();
const client = redis.createClient(6379);
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
const server = http.createServer(app);
const db = require("./app/models");

db.sequelize.sync();
client.connect();
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
require("./app/routes/imap.routes")(app, sse, client);

// set port, listen for requests
const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}.`);
});
module.exports = server;
