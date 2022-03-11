const Imap = require('node-imap');
const db = require('../models');
const ImapInfo = db.imapInfo;
const utils = require('../utils/regexp');
/**
 *  Create imap info account
 * @param  {} req
 * @param  {} res
 */
exports.createImapInfo = (req, res) => {
  if (!req.body.email || !req.body.host || !req.body.port) {
    res.status(400).send({
      error: 'Content can not be empty!',
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
  const imap = new Imap({
    user: imapInfo.email,
    password: req.body.password,
    host: imapInfo.host,
    port: imapInfo.port,
    tls: imapInfo.tls,
  });
  // Ensures that the account exists
  imap.connect();
  imap.once('ready', () => {
    ImapInfo.findOne({ where: { email: imapInfo.email } }).then((imapdata) => {
      if (imapdata === null) {
        // Save ImapInfo in the database
        ImapInfo.create(imapInfo)
          .then((data) => {
            res.status(200).send({ imapdata: data });
          })
          .catch(() => {
            res.status(500).send({
              error:
                'Some error occurred while creating your account imap info.',
            });
          });
      } else {
        res.status(200).send({
          message: 'Your account already exists !',
          imapdata,
        });
      }
      imap.end();
    });
  });
  // The imap account does not exists or connexion denied
  imap.once('error', () => {
    res.status(500).send({
      message: 'We can\'t connect to your imap account',
    });
  });
};

exports.loginToAccount = (req, res) => {
  if (!req.body.email) {
    res.status(400).send({
      error: 'Content can not be empty!',
    });
    return;
  }
  ImapInfo.findOne({ where: { email: req.body.email } }).then((imap) => {
    if (imap === null) {
      // Save ImapInfo in the database
      res.status(500).send({
        error: 'Your account does not exist ! try to sign up.',
      });
    } else {
      res.status(200).send({
        message: 'Welcome back !',
        imap,
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
  ImapInfo.findByPk(req.params.id)
    .then((imapInfo) => {
      const imap = new Imap({
        user: imapInfo.email,
        password: req.query.password,
        host: imapInfo.host,
        port: imapInfo.port,
        tls: true,
      });
      let Boxes = [];
      imap.connect();
      imap.once('ready', () => {
        imap.getBoxes('', async (err, boxes) => {
          Boxes = utils.getBoxesAll(boxes);
        });
        imap.end();
      });
      imap.once('error', (err) => {
        res.status(500).send({
          error: err,
        });
      });

      imap.once('end', () => {
        if (Boxes.length > 0) {
          res.status(200).send({
            boxes: Boxes,
          });
        } else {
          res.status(204).send({
            error: 'No boxes found!',
          });
        }
      });
    })
    .catch(() => {
      res.status(404).send({
        error: `No account with id : ${req.params.id} found`,
      });
    });
};

exports.getEmails = async (req, res) => {
  let socketInstance;
  let io;
  //fetch imap from database then getemails
  ImapInfo.findByPk(req.params.id).then((imapInfo) => {
    const imap = new Imap({
      user: imapInfo.email,
      password: 'M0u571m1n!',
      host: imapInfo.host,
      port: imapInfo.port,
      tls: true,
    });
    // data will include all of the data that will be mined from the mailbox.
    const data = [];
    // bodiesTofetch is the query that user sends
    const bodiesTofetch = req.query.fields;

    // get the socket instance
    if (req.query.SessionId) {
      io = req.app.get('io');
      const sockets = req.app.get('sockets');
      const thisSocketId = sockets[req.query.SessionId];
      socketInstance = io.to(thisSocketId);
    }
    imap.connect();
    // globalData will be the final mined data(after the "end event")
    let globalData = [];
    // selected boxes from the user
    const boxess = req.query.boxes.split(',');
    let folders = [];
    let boxes = [];
    folders = req.query.folders.map((element) => {
      return JSON.parse(element);
    });
    boxes = boxess.map((element) => {
      const path = utils.getPath({ ...folders }, element);
      return path.substring(1);
    });

    // initial values for the loopfunction (in case we have more than one mailfile to collect data from).
    const box = boxes[0];
    let i = 0;
    imap.once('ready', function () {
      for (const j in boxes) {
        const loopfunc = (box) => {
          if (socketInstance) {
            // emit switching to another box to initialise progress labels
            socketInstance.emit('switching', true);
          }
          // open the mailbox and fetch fields
          imap.openBox(box, true, async function (err, box) {
            if (socketInstance) {
              // emit total messages usefull for progress bar

              socketInstance.emit('totalMessages', box.messages.total);

              // emit the current file name
              socketInstance.emit('boxName', box.name);
            }
            if (err) throw err;
            const f = imap.seq.fetch('1:*', {
              bodies: bodiesTofetch,
              struct: true,
            });

            // callback for "message" emitted event
            await f.on('message', async function (msg, seqno) {
              if (socketInstance) {
                // emit how many email messages have been scanned
                socketInstance.emit('uploadProgress', seqno);
              }
              // callback for "body" emitted event
              await msg.on('body', async function (stream) {
                let buffer = '';
                // callback for "data" emitted event
                await stream.on('data', function (chunk) {
                  buffer += chunk.toString('utf8');
                  // append to data the parsed buffer
                  data.push(...Object.values(Imap.parseHeader(buffer)));
                  //console.log(Object.values(Imap.parseHeader(buffer)));
                  // define limite
                });
                // callback for "end" emitted event, here all messaged are parsed, data is the source of data
              });
            });
            f.once('error', function (err) {
              res.status(500).send({
                error: err,
              });
            });

            f.once('end', function () {
              console.log('Done fetching all messages!');
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

    imap.once('error', function (err) {
      res.status(500).send({
        error: err,
      });
    });

    imap.once('end', async function () {
      globalData = [...data.flat()];
      const emailsAfterRegex = await utils.matchRegexp(globalData);
      await utils.checkDomainType(emailsAfterRegex).then((data) => {
        res.status(200).send({
          data: data,
        });
      });
      console.log('Connection ended');
      // setTimeout(() => {
      //   if (socketInstance) {
      //     // emit fetched emails
      //     socketInstance.emit("cleaningData", true);
      //   }
      // }, 200);
      // setTimeout(() => {
      //   if (socketInstance) {
      //     // emit fetched emails
      //     socketInstance.emit("duplicates", true);
      //   }
      // }, 400);
      // setTimeout(() => {
      //   if (socketInstance) {
      //     // emit how many email messages have been scanned
      //     socketInstance.emit("end", true);
      //   }
      //   res.status(200).send({
      //     data: emailsAfterCheckDomain,
      //   });
      // }, 1900);
    });
  });
};
