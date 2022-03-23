const Imap = require("node-imap");
const db = require("../models");
const ImapInfo = db.imapInfo;
const logger = require("../utils/logger")(module);
var utils = require("../utils/regexp");
var qualificationServices = require("../services/dataQualificationService");
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
  const imap = new Imap({
    user: imapInfo.email,
    password: req.body.password,
    host: imapInfo.host,
    port: imapInfo.port,
    tls: imapInfo.tls,
  });
  // Ensures that the account exists
  imap.connect();
  imap.once("ready", () => {
    ImapInfo.findOne({ where: { email: imapInfo.email } }).then((imapdata) => {
      if (imapdata === null) {
        // Save ImapInfo in the database
        ImapInfo.create(imapInfo)
          .then((data) => {
            res.status(200).send({ imapdata: data });
          })
          .catch(() => {
            logger.error(`can't create account with email ${req.body.email}`);
            res.status(500).send({
              error:
                "Some error occurred while creating your account imap info.",
            });
          });
      } else {
        logger.info(
          `On signup : Account with email ${req.body.email} already exist`
        );
        res.status(200).send({
          message: "Your account already exists !",
          imapdata,
        });
      }
      imap.end();
    });
  });
  // The imap account does not exists or connexion denied
  imap.once("error", () => {
    logger.error(
      `Can't connect to imap account with email ${req.body.email} and host ${req.body.host}`
    );
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
  ImapInfo.findOne({ where: { email: req.body.email } }).then((imap) => {
    if (imap === null) {
      logger.error(
        `On login : Account with email ${req.body.email} does not exist`
      );

      // Save ImapInfo in the database
      res.status(500).send({
        error: "Your account does not exist ! try to sign up.",
      });
    } else {
      logger.info(`Account with email ${req.body.email} succesfully logged in`);
      res.status(200).send({
        message: "Welcome back !",
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
      imap.once("ready", () => {
        logger.info(
          `Begin fetching folders names from imap account with email : ${imapInfo.email}`
        );
        imap.getBoxes("", async (err, boxes) => {
          Boxes = utils.getBoxesAll(boxes);
        });
        imap.end();
      });
      imap.once("error", (err) => {
        logger.error(
          `error occured when trying to connect to imap account with email : ${imapInfo.email}`
        );

        res.status(500).send({
          error: err,
        });
      });

      imap.once("end", () => {
        logger.info(
          `End fetching folders names from imap account with email : ${imapInfo.email}`
        );
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
    })
    .catch(() => {
      logger.error(`No account with email : ${req.params.id} found`);
      res.status(404).send({
        error: `No account with id : ${req.params.id} found`,
      });
    });
};

exports.getEmails = (req, res, sse) => {
  if (req.query.password) {
    //fetch imap from database then getemails
    ImapInfo.findByPk(req.params.id).then((imapInfo) => {
      const imap = new Imap({
        user: imapInfo.email,
        password: req.query.password,
        host: imapInfo.host,
        port: imapInfo.port,
        tls: true,
      });
      // data will include all of the data that will be mined from the mailbox.
      const data = [];
      let globalData = [];
      let database = [];
      // selected boxes from the user
      const boxess = req.query.boxes;
      let folders = [];
      let boxes = [];
      // bodiesTofetch is the query that user sends
      const bodiesTofetch = req.query.fields;
      // get the socket instance

      imap.connect();
      folders = req.query.folders.map((element) => {
        return JSON.parse(element);
      });
      boxes = boxess.map((element) => {
        const path = utils.getPath({ ...folders }, element);
        return path.substring(1);
      });
      console.log(folders, boxess);
      // initial values for the loopfunction (in case we have more than one mailfile to collect data from).
      const box = boxes[0];
      let i = 0;
      imap.once("ready", function () {
        logger.info(
          `Begin collecting emails from imap account with email : ${imapInfo.email}`
        );
        boxes.forEach(async (box) => {
          // open the mailbox and fetch fields
          await imap.openBox(box, true, async function (err, currentbox) {
            if (typeof currentbox != "undefined") {
              var sends = await utils.EqualPartsForSocket(
                currentbox.messages.total
              );

              const f = imap.seq.fetch("1:*", {
                bodies: bodiesTofetch,
                struct: true,
              });
              // callback for "message" emitted event
              await f.on("message", async function (msg, seqno) {
                if (sends.includes(seqno)) {
                  sse.send(box, "box");
                  sse.send(
                    Math.round((seqno * 100) / currentbox.messages.total) / 100,
                    "percentage"
                  );
                }

                // callback for "body" emitted event
                await msg.on("body", async function (stream) {
                  let buffer = "";
                  // callback for "data" emitted event
                  await stream.on("data", function (chunk) {
                    buffer += chunk.toString("utf8");
                    // append to data the parsed buffer
                    data.push(...Object.values(Imap.parseHeader(buffer)));
                    //console.log(Object.values(Imap.parseHeader(buffer)));
                    // define limite
                    let dataTobeStored = Imap.parseHeader(buffer);
                    let msg = Object.keys(dataTobeStored).map((element) => {
                      return {
                        email: dataTobeStored[element],
                        field: element,
                        folder: currentbox.name,
                        msgId: seqno,
                      };
                    });
                    database.push(...msg);
                  });
                  // callback for "end" emitted event, here all messaged are parsed, data is the source of data
                });
              });
              f.once("error", function (err) {
                logger.error(
                  `Error occured when collecting emails from imap account with email : ${imapInfo.email}`
                );
                res.status(500).send({
                  error: err,
                });
              });
              f.once("end", function () {
                sse.send(1, "percentage");
                if (box == boxes[boxes.length - 1]) {
                  imap.end();
                }
              });
            }
          });
        });
      });

      imap.once("error", function (err) {
        logger.error(
          `Error occured when collecting emails from imap account with email : ${imapInfo.email}`
        );
        res.status(500).send({
          error: err,
        });
      });
      imap.once("end", async function () {
        logger.info(
          `End collecting emails from imap account with email : ${imapInfo.email}`
        );
        globalData = [...data.flat()];
        //const emailsAfterRegex = await utils.matchRegexp(globalData);
        await qualificationServices
          .databaseQualification(database, boxes)
          .then(async (data) => {
            // await utils.addDomainsToValidAndInvalid(data).then((data) => {
            res.status(200).send({
              data: data,
            });
            //await utils.addDomainsToValidAndInvalid(data);
            // });
          });
        // await utils.checkDomainType(emailsAfterRegex).then((data) => {
        //
        // });
      });
    });
  }
};
