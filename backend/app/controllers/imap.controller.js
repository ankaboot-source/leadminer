const db = require("../models");
var Imap = require("node-imap");
inspect = require("util").inspect;
const ImapInfo = db.imapInfo;
var utils = require("../utils/regexp");
/**
 *  Create imap info account
 * @param  {} req
 * @param  {} res
 */
exports.createImapInfo = (req, res) => {
  if (!req.body.email || !req.body.host || !req.body.port) {
    res.status(400).send({
      error: "Content can not be empty!",
    });
    return;
  }
  // imapInfo object
  const imapInfo = {
    email: req.body.email,
    host: req.body.host,
    port: req.body.port,
    tls: req.body.tls ? req.body.tls : true,
  };
  var imap = new Imap({
    user: imapInfo.email,
    password: req.body.password,
    host: imapInfo.host,
    port: imapInfo.port,
    tls: true,
  });
  // Ensures that the account exists
  imap.connect();
  imap.end();
  imap.once("end", function () {
    ImapInfo.findOne({ where: { email: imapInfo.email } }).then((imap) => {
      if (imap == null) {
        // Save ImapInfo in the database
        ImapInfo.create(imapInfo)
          .then((data) => {
            console.log(data);
            res.status(200).send({ imap: data });
          })
          .catch((err) => {
            res.status(500).send({
              error:
                "Some error occurred while creating your account imap info.",
            });
          });
      } else {
        res.status(200).send({
          message: "Your account already exists !",
          imap: imap,
        });
      }
    });
  });
  // The imap account does not exists or connexion denied
  imap.once("error", function (err) {
    res.status(500).send({
      message: "We can't connect to your imap account",
    });
  });
};

exports.loginToAccount = (req, res) => {
  if (!req.body.email) {
    res.status(400).send({
      error: "Content can not be empty!",
    });
    return;
  }
  // // imapInfo object
  // const imapInfo = {
  //   email: req.body.email,
  //   host: req.body.host,
  //   port: req.body.port,
  //   tls: req.body.tls ? req.body.tls : true,
  // };
  // var imap = new Imap({
  //   user: imapInfo.email,
  //   password: req.body.password,
  //   host: imapInfo.host,
  //   port: imapInfo.port,
  //   tls: true,
  // });
  // // Ensures that the account exists
  // imap.connect();
  // imap.end();
  ImapInfo.findOne({ where: { email: req.body.email } }).then((imap) => {
    if (imap == null) {
      // Save ImapInfo in the database
      res.status(500).send({
        error: "Your account does not exist ! try to sign up.",
      });
    } else {
      res.status(200).send({
        message: "Welcome back !",
        imap: imap,
      });
    }
  });
};

/**
 * Retrieve mailbox files
 * @param  {} req
 * @param  {} res
 */
exports.getImapBoxes = async (req, res) => {
  // retrive imap connection infos from database
  ImapInfo.findByPk(req.params.id).then((imapInfo) => {
    console.log(imapInfo);
    var imap = new Imap({
      user: imapInfo.email,
      password: "M0u571m1n!",
      host: imapInfo.host,
      port: imapInfo.port,
      tls: true,
    });
    let Boxes = [];
    imap.connect();
    imap.once("ready", function () {
      imap.getBoxes("", (err, boxes) => {
        Boxes = Object.keys(boxes);
      });
      imap.end();
    });
    imap.once("error", function (err) {
      console.log(err);
      res.status(500).send({
        error: err,
      });
    });

    imap.once("end", function () {
      console.log(Boxes);
      if (Boxes.length > 0) {
        res.status(200).send({
          boxes: Boxes,
        });
      } else {
        res.status(204).send({
          error: "No boxes found!",
        });
      }
    });
  });
};

exports.getEmails = async (req, res) => {
  //fetch imap from database then getemails
  ImapInfo.findByPk(req.params.id).then((imapInfo) => {
    var imap = new Imap({
      user: imapInfo.email,
      password: "M0u571m1n!",
      host: imapInfo.host,
      port: imapInfo.port,
      tls: true,
    });
    // data will include all of the data that will be mined from the mailbox.
    var data = [];
    // bodiesTofetch is the query that user sends
    let bodiesTofetch = req.query.fields;

    // get the socket instance
    if (req.query.SessionId) {
      const io = req.app.get("io");
      const sockets = req.app.get("sockets");
      const thisSocketId = sockets[req.query.SessionId];
      var socketInstance = io.to(thisSocketId);
    }
    imap.connect();
    // globalData will be the final mined data(after the "end event")
    var globalData = [];
    // result is the filtred, and ready to send data
    var result = [];
    // selected boxes from the user
    var boxes = req.query.boxes.split(",");

    // initial values for the loopfunction (in case we have more than one mailfile to collect data from).
    var box = boxes[0];
    var i = 0;
    imap.once("ready", function () {
      for (let j in boxes) {
        loopfunc = (box) => {
          if (socketInstance) {
            // emit switching to another box to initialise progress labels
            socketInstance.emit("switching", true);
          }
          // open the mailbox and fetch fields
          imap.openBox(box, true, function (err, box) {
            if (socketInstance) {
              // emit total messages usefull for progress bar

              socketInstance.emit("totalMessages", box.messages.total);

              // emit the current file name
              socketInstance.emit("boxName", box.name);
            }
            if (err) throw err;
            var f = imap.seq.fetch("1:300", {
              bodies: bodiesTofetch,
              struct: true,
            });
            // callback for "message" emitted event
            f.on("message", function (msg, seqno) {
              if (socketInstance) {
                // emit how many email messages have been scanned
                socketInstance.emit("uploadProgress", seqno);
              }
              // callback for "body" emitted event
              msg.on("body", function (stream, info) {
                var buffer = "";
                // callback for "data" emitted event
                stream.on("data", function (chunk) {
                  buffer += chunk.toString("utf8");
                  // append to data the parsed buffer
                  data.push(...Object.values(Imap.parseHeader(buffer)));
                  // define limite
                });
                // callback for "end" emitted event, here all messaged are parsed, data is the source of data
                stream.once("end", function () {
                  globalData = [...data.flat()];
                  result = utils.matchRegexp(globalData);
                });
              });
            });
            f.once("error", function (err) {
              res.status(500).send({
                error: err,
              });
              console.log("Fetch error: " + err);
            });

            f.once("end", function () {
              console.log("Done fetching all messages!");
              if (box.name == boxes[boxes.length - 1]) {
                imap.end();
              } else {
                i++;
                loopfunc(boxes[i]);
              }
            });
          });
        };
        if (j == 0) {
          loopfunc(box);
        }
      }
    });

    imap.once("error", function (err) {
      res.status(500).send({
        error: err,
      });
    });

    imap.once("end", function () {
      console.log("Connection ended");
      setTimeout(() => {
        if (socketInstance) {
          // emit fetched emails
          socketInstance.emit("cleaningData", true);
        }
      }, 1000);
      setTimeout(() => {
        if (socketInstance) {
          // emit fetched emails
          socketInstance.emit("duplicates", true);
        }
      }, 2000);
      setTimeout(() => {
        res.status(200).send({
          data: result.slice(0, 100),
        });
      }, 3000);
    });
  });
};
