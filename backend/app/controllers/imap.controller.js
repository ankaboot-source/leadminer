const db = require("../models");
var Imap = require("node-imap");
const { Console } = require("console");
const { nextTick } = require("process");
const { resolve } = require("path");
inspect = require("util").inspect;
const ImapInfo = db.imapInfo;
const Op = db.Sequelize.Op;

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
      password: req.params.password,
      host: imapInfo.host,
      port: imapInfo.port,
      tls: true,
    });
    // data to be delivred to the client
    var data = [];
    // bodiesTofetch is the query that user sends
    let bodiesTofetch = req.query.fields;

    // open boxes selected by the user
    // async function openInbox(cb) {
    //   let boxes = req.query.boxes.split(",");

    //   await new Promise((resolve) => {
    //     boxes.forEach((box) => {
    //       try {
    //         imap.openBox(box, true, cb);
    //       } catch (e) {
    //         console.log(e);
    //       } finally {
    //         console.log(box);
    //         if (box == boxes[boxes.length]) {
    //           resolve();
    //         }
    //       }
    //     });
    //   });
    // }

    // get the socket instance
    if (req.query.SessionId) {
      const io = req.app.get("io");
      const sockets = req.app.get("sockets");
      const thisSocketId = sockets[req.query.SessionId];
      var socketInstance = io.to(thisSocketId);
    }
    imap.connect();
    var globalData = [];
    var boxes = req.query.boxes.split(",");

    // open the mailbox and fetch fields
    var box = boxes[0];
    var i = 0;
    imap.once("ready", function () {
      for (let j in boxes) {
        loopfunc = (box) => {
          imap.openBox(box, true, function (err, box) {
            if (socketInstance) {
              // emit total messages usefull for progress bar
              socketInstance.emit("totalMessages", box.messages.total);
              socketInstance.emit("boxName", box.name);
            }

            if (err) throw err;
            var f = imap.seq.fetch("1:90", {
              bodies: bodiesTofetch,
              struct: true,
            });
            f.on("message", function (msg, seqno) {
              if (socketInstance) {
                // emit fetched emails
                socketInstance.emit("uploadProgress", seqno);
              }

              msg.on("body", function (stream, info) {
                var buffer = "";
                stream.on("data", function (chunk) {
                  buffer += chunk.toString("utf8");
                  data = [
                    ...data,
                    [].concat.apply(
                      [],
                      Object.values(Imap.parseHeader(buffer))
                    ),
                  ];
                  data = [...new Set([].concat.apply([], data))].filter(
                    (item) => item.includes("@")
                  );
                  // define the limite here, if we collect 100 email no need to continue
                  if (data.length == 100) {
                    imap.end();
                  }
                  // append data to globalData
                  globalData.push(...data);
                  globalData = [
                    ...new Set([].concat.apply([], globalData)),
                  ].filter((item) => item.includes("@"));
                });
                if (socketInstance) {
                  // emit fetched emails
                  socketInstance.emit("uploadProgress", globalData.length);
                }
                stream.once("end", function () {});
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
          data: globalData.slice(0, 100),
        });
      }, 3000);
    });
  });
};
