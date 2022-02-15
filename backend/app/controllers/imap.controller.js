const db = require("../models");
var Imap = require("node-imap");
const { imapInfo } = require("../models");
inspect = require("util").inspect;
const ImapInfo = db.imapInfo;
const Op = db.Sequelize.Op;

// Find imap account by id
const findImap = async (id) => {
  const imap = await ImapInfo.findByPk(id);
  if (imap == null) {
    return null;
  } else {
    return imap;
  }
};

// Find imap account by email.
const findOneByEmail = async (query) => {
  const imap = await ImapInfo.findOne({ where: { email: query } });
  if (imap === null) {
    return null;
  } else {
    return imap;
  }
};

// Create and Save a new Tutorial
exports.createImapInfo = (req, res) => {
  if (!req.body.email || !req.body.host || !req.body.port) {
    res.status(400).send({
      error: "Content can not be empty!",
    });
    return;
  }

  // Create a imapInfo
  const imapInfo = {
    email: req.body.email, //"contact@mouslimin.fr",
    host: req.body.host, //"imap.ionos.fr", //req.body.host, //"imap.ionos.fr",
    port: req.body.port, // 993, //req.body.port, //993,
    tls: req.body.tls ? req.body.tls : true,
  };
  findOneByEmail(imapInfo.email).then((imap) => {
    if (imap == null) {
      // Save ImapInfo in the database
      ImapInfo.create(imapInfo)
        .then((data) => {
          res.send(data);
        })
        .catch((err) => {
          res.status(500).send({
            error:
              err.message ||
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
};

// Retrieve all Tutorials from the database.
// exports.findAll = (req, res) => {
//   const title = req.query.title;
//   var condition = title ? { title: { [Op.iLike]: `%${title}%` } } : null;

//   Tutorial.findAll({ where: condition })
//     .then((data) => {
//       res.send(data);
//     })
//     .catch((err) => {
//       res.status(500).send({
//         message:
//           err.message || "Some error occurred while retrieving tutorials.",
//       });
//     });
// };

// // Find a single Tutorial with an id
exports.findOne = (req, res) => {
  const id = req.params.id;
  ImapInfo.findByPk(id)
    .then((data) => {
      if (data) {
        res.send(data);
      } else {
        res.status(404).send({
          message: `Cannot find imap infos with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      res.status(500).send({
        message: "Error retrieving imap account infos with id=" + id,
      });
    });
};

// // Update a Tutorial by the id in the request
// exports.update = (req, res) => {
//   const id = req.params.id;

//   Tutorial.update(req.body, {
//     where: { id: id },
//   })
//     .then((num) => {
//       if (num == 1) {
//         res.send({
//           message: "Tutorial was updated successfully.",
//         });
//       } else {
//         res.send({
//           message: `Cannot update Tutorial with id=${id}. Maybe Tutorial was not found or req.body is empty!`,
//         });
//       }
//     })
//     .catch((err) => {
//       res.status(500).send({
//         message: "Error updating Tutorial with id=" + id,
//       });
//     });
// };

// // Delete a Tutorial with the specified id in the request
// exports.delete = (req, res) => {
//   const id = req.params.id;

//   Tutorial.destroy({
//     where: { id: id },
//   })
//     .then((num) => {
//       if (num == 1) {
//         res.send({
//           message: "Tutorial was deleted successfully!",
//         });
//       } else {
//         res.send({
//           message: `Cannot delete Tutorial with id=${id}. Maybe Tutorial was not found!`,
//         });
//       }
//     })
//     .catch((err) => {
//       res.status(500).send({
//         message: "Could not delete Tutorial with id=" + id,
//       });
//     });
// };

// // Delete all Tutorials from the database.
// exports.deleteAll = (req, res) => {
//   Tutorial.destroy({
//     where: {},
//     truncate: false,
//   })
//     .then((nums) => {
//       res.send({ message: `${nums} Tutorials were deleted successfully!` });
//     })
//     .catch((err) => {
//       res.status(500).send({
//         message:
//           err.message || "Some error occurred while removing all tutorials.",
//       });
//     });
// };

// find all published Tutorial
// exports.findAllPublished = (req, res) => {
//   Tutorial.findAll({ where: { published: true } })
//     .then((data) => {
//       res.send(data);
//     })
//     .catch((err) => {
//       res.status(500).send({
//         message:
//           err.message || "Some error occurred while retrieving tutorials.",
//       });
//     });
// };

exports.getImapBoxes = (req, res) => {
  findImap(req.params.id).then((imapInfo) => {
    console.log(imapInfo);
    var imap = new Imap({
      user: imapInfo.email, //"contact@mouslimin.fr", //imapInfo.email, //"contact@mouslimin.fr",
      password: "M0u571m1n!",
      host: imapInfo.host, //"imap.ionos.fr", //imapInfo.host, //"imap.ionos.fr",
      port: imapInfo.port, //993, //imapInfo.port, //993,
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
  findImap(req.params.id).then((imapInfo) => {
    var imap = new Imap({
      user: imapInfo.email, //"contact@mouslimin.fr", //imapInfo.email, //"contact@mouslimin.fr",
      password: "M0u571m1n!",
      host: imapInfo.host, //"imap.ionos.fr", //imapInfo.host, //"imap.ionos.fr",
      port: imapInfo.port, //993, //imapInfo.port, //993,
      tls: true,
    });
    var data = [];
    function openInbox(cb) {
      imap.openBox(req.params.box, true, cb);
    }
    console.log(req.query.SessionId);
    const io = req.app.get("io");
    const sockets = req.app.get("sockets");
    const thisSocketId = sockets[req.query.SessionId];
    console.log(thisSocketId);
    const socketInstance = io.to(thisSocketId);
    imap.once("ready", function () {
      openInbox(function (err, box) {
        socketInstance.emit("totalMessages", box.messages.total);
        if (err) throw err;
        var f = imap.seq.fetch("1:*", {
          bodies: "HEADER.FIELDS (FROM TO SUBJECT DATE)",
          struct: true,
        });
        f.on("message", function (msg, seqno) {
          socketInstance.emit("uploadProgress", seqno);
          var prefix = "(#" + seqno + ") ";

          msg.on("body", function (stream, info) {
            var buffer = "";
            stream.on("data", function (chunk) {
              buffer += chunk.toString("utf8");
              //console.log("Message #%d", buffer);
            });
            stream.once("end", function () {
              data = [...data, Imap.parseHeader(buffer)];
            });
          });
        });
        f.once("error", function (err) {
          console.log("Fetch error: " + err);
        });
        f.once("end", function () {
          res.status(200).send({
            data: data,
          });
          console.log("Done fetching all messages!");
          imap.end();
        });
      });
    });

    imap.once("error", function (err) {
      console.log(err);
    });

    imap.once("end", function () {
      console.log("Connection ended");
    });

    imap.connect();
  });
};
