const db = require("../models");
var Imap = require("node-imap");
inspect = require("util").inspect;
const ImapInfo = db.imapInfo;
const Op = db.Sequelize.Op;

// Find imap account by id
const findImap = async (id) => {
  await ImapInfo.findByPk(id);
};

// Find imap account by email.
const findOneByEmail = async (query) => {
  await ImapInfo.findOne({ where: { email: query } });
};

// // Find a single Tutorial with an id
exports.findOne = (req, res) => {
  const id = req.params.id;
  ImapInfo.findByPk(id)
    .then((data) => {
      if (data) {
        res.send(data);
      } else {
        res.status(404).send({
          error: `Cannot find imap infos with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      res.status(500).send({
        error: "Error retrieving imap account infos with id=" + id,
      });
    });
};
// Create and Save a new ImapInfo
exports.createImapInfo = (req, res) => {
  if (!req.body.email || !req.body.host || !req.body.port) {
    res.status(400).send({
      error: "Content can not be empty!",
    });
    return;
  }
  // Create a imapInfo
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
  imap.connect();
  imap.end();
  imap.once("end", function () {
    findOneByEmail(imapInfo.email).then((imap) => {
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
  imap.once("error", function (err) {
    res.status(500).send({
      message: "We can't connect to your imap account",
    });
  });
};

exports.getImapBoxes = (req, res) => {
  findImap(req.params.id).then((imapInfo) => {
    var imap = new Imap({
      user: imapInfo.email,
      password: req.params.password,
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
  findImap(req.params.id).then((imapInfo) => {
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
    let bodiesTofetch;
    if (req.query.fields) {
      bodiesTofetch = req.query.fields;
    } else {
      bodiesTofetch = ["HEADER.FIELDS (TO FROM BCC CC)", "TEXT"];
    }
    function openInbox(cb) {
      imap.openBox(req.params.box, true, cb);
    }
    // get the socket instance
    if (req.query.SessionId) {
      const io = req.app.get("io");
      const sockets = req.app.get("sockets");
      const thisSocketId = sockets[req.query.SessionId];
      var socketInstance = io.to(thisSocketId);
    }
    // open the mailbox and fetch fields
    imap.once("ready", function () {
      openInbox(function (err, box) {
        if (socketInstance) {
          // emit total messages usefull for progress bar
          socketInstance.emit("totalMessages", box.messages.total);
        }
        if (err) throw err;
        var f = imap.seq.fetch("1:*", {
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
            });
            stream.once("end", function () {
              data = [
                ...data,
                [].concat.apply([], Object.values(Imap.parseHeader(buffer))),
              ];

              data = [...new Set([].concat.apply([], data))].filter((item) =>
                item.includes("@")
              );
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
              data: data,
            });
          }, 3000);

          console.log("Done fetching all messages!");
          imap.end();
        });
      });
    });

    imap.once("error", function (err) {
      res.status(500).send({
        error: err,
      });
    });

    imap.once("end", function () {
      console.log("Connection ended");
    });

    imap.connect();
  });
};
