const Imap = require("node-imap");
const db = require("../models");
const dns = require("dns");
const { simpleParser } = require("mailparser");
const ImapInfo = db.imapInfo;
var inspect = require("util").inspect;
const logger = require("../utils/logger")(module);
var utilsForRegEx = require("../utils/regexp");
var utilsForDataManipulation = require("../utils/extractors");
var qualificationServices = require("../services/dataQualificationService");
const { utils } = require("mocha");
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
          .catch((err) => {
            console.log(err);
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
          Boxes = utilsForRegEx.getBoxesAll(boxes);
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

exports.getEmails = (req, res, sse, client) => {
  if (req.query.password) {
    //fetch imap from database then getemails
    ImapInfo.findByPk(req.params.id).then((imapInfo) => {
      const imap = new Imap({
        user: imapInfo.email,
        password: req.query.password,
        host: imapInfo.host,
        port: imapInfo.port,
        tls: true,
        connTimeout: 20000,
        authTimeout: 7000,
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
        const path = utilsForRegEx.getPath({ ...folders }, element);
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
        for (let j in boxes) {
          const loopfunc = (box) => {
            imap.openBox(box, true, async function (err, currentbox) {
              if (typeof currentbox != "undefined") {
                var sends = await utilsForRegEx.EqualPartsForSocket(
                  currentbox.messages.total
                );
                console.log(bodiesTofetch);
                const f = imap.seq.fetch("1:*", {
                  bodies: bodiesTofetch,
                  struct: true,
                });
                // callback for "message" emitted event
                await f.on("message", async function (msg, seqno) {
                  //console.log(seqno);
                  if (sends.includes(seqno)) {
                    sse.send(box, "box");
                    sse.send(
                      Math.round((seqno * 100) / currentbox.messages.total) /
                        100,
                      "percentage"
                    );
                  }

                  // callback for "body" emitted event
                  let dataTobeStored = {};
                  await msg.on("body", async function (stream, info) {
                    let buffer = "";

                    stream.on("data", async function (chunk) {
                      buffer += chunk.toString("utf8");

                      Object.assign(dataTobeStored, Imap.parseHeader(buffer));

                      if (
                        bodiesTofetch.includes("TEXT") &&
                        info.which == "TEXT"
                      ) {
                        let parsed = await simpleParser(buffer, {
                          skipImageLinks: true,
                          skipTextToHtml: true,
                        });
                        //console.log(parsed);
                        if (parsed && typeof parsed.text != "undefined") {
                          let body = utilsForRegEx.extractEmailsFromBody(
                            parsed.text
                          );
                          if (body != null) {
                            dataTobeStored["body"] = body;
                          }
                        }
                      }
                      Object.keys(dataTobeStored).map((element) => {
                        //console.log(dataTobeStored[element]);
                        // regexp
                        if (dataTobeStored[element][0].includes("@")) {
                          //console.log(dataTobeStored);
                          let email =
                            element != "body"
                              ? utilsForRegEx.extractNameAndEmail(
                                  dataTobeStored[element]
                                )
                              : utilsForRegEx.extractNameAndEmailForBody(
                                  dataTobeStored[element]
                                );
                          //console.log(email);
                          // check existence in database or data array
                          email.map(async (oneEmail) => {
                            //console.log(oneEmail);
                            if (oneEmail) {
                              let domain = oneEmail.address.split("@")[1];
                              //console.log(domain, oneEmail.address);
                              let domainRedis = await client.get(domain);
                              //console.log(domainRedis);
                              if (!domainRedis) {
                                await client.set(domain, domain, {
                                  EX: 60,
                                });
                              }
                              if (
                                domainRedis &&
                                utilsForDataManipulation.checkForNoReply(
                                  oneEmail,
                                  imapInfo.email
                                )
                              ) {
                                let isExist =
                                  utilsForDataManipulation.checkExistence(
                                    database,
                                    oneEmail
                                  );
                                let emailInfo = {
                                  email: oneEmail,
                                  field: [[element, 1]],
                                  folder: [currentbox.name],
                                  msgId: seqno,
                                };
                                utilsForDataManipulation.addEmailType(
                                  emailInfo
                                );
                                if (!isExist) {
                                  utilsForDataManipulation.addEmailToDatabase(
                                    database,
                                    emailInfo
                                  );
                                } else {
                                  utilsForDataManipulation.addFieldsAndFolder(
                                    database,
                                    emailInfo
                                  );
                                }
                                if (sends.includes(seqno)) {
                                  sse.send(database, "data");
                                }
                                if (
                                  currentbox.name == boxes[boxes.length - 1] &&
                                  seqno + 10 > currentbox.messages.total
                                ) {
                                  console.log("yes");
                                  sse.send(false, "dns");
                                }
                              } else if (
                                utilsForDataManipulation.checkForNoReply(
                                  oneEmail,
                                  imapInfo.email
                                ) &&
                                !domainRedis
                              ) {
                                const promise = new Promise(
                                  (resolve, reject) => {
                                    console.log(typeof domain);
                                    if (domain) {
                                      dns.resolveMx(
                                        domain,
                                        async (error, addresses) => {
                                          //console.log(domain);

                                          if (addresses) {
                                            await client.set(domain, "ok", {
                                              EX: 40,
                                            });

                                            let isExist =
                                              utilsForDataManipulation.checkExistence(
                                                database,
                                                oneEmail
                                              );
                                            let emailInfo = {
                                              email: oneEmail,
                                              field: [[element, 1]],
                                              folder: [currentbox.name],
                                              msgId: seqno,
                                            };
                                            utilsForDataManipulation.addEmailType(
                                              emailInfo
                                            );
                                            if (!isExist) {
                                              utilsForDataManipulation.addEmailToDatabase(
                                                database,
                                                emailInfo
                                              );
                                            } else {
                                              utilsForDataManipulation.addFieldsAndFolder(
                                                database,
                                                emailInfo
                                              );
                                            }
                                            if (sends.includes(seqno)) {
                                              sse.send(database, "data");
                                            }
                                            if (
                                              currentbox.name ==
                                                boxes[boxes.length - 1] &&
                                              seqno + 10 >
                                                currentbox.messages.total
                                            ) {
                                              console.log("yes");
                                              sse.send(false, "dns");
                                            }
                                            //console.log("helo val");
                                          } else {
                                            await client.set(domain, "ko", {
                                              EX: 40,
                                            });
                                            //console.log("helo inval");
                                            resolve(false);
                                          }
                                        }
                                      );
                                    }
                                  }
                                );
                                await promise;
                              } else {
                                console.log("helo");
                              }
                            }
                          });
                        }
                      });
                    });

                    // callback for "end" emitted event, here all messaged are parsed, data is the source of data
                  });
                  await msg.on("end", async function () {});
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
                  } else {
                    //sse.send(0, "percentage");
                    i++;
                    loopfunc(boxes[i]);
                  }
                });
              }
            });
          };
          if (j == 0) {
            loopfunc(box);
          }
        }
      });
      imap.once("error", function (err) {
        logger.error(
          `Error occured when collecting emails from imap account with email : ${imapInfo.email}`
        );
        console.log(err);
        res.status(500).send({
          error: err,
        });
      });
      imap.once("end", async function () {
        logger.info(
          `End collecting emails from imap account with email : ${imapInfo.email}`
        );
        globalData = [...data.flat()];

        //const emailsAfterRegex = await utilsForRegEx.matchRegexp(globalData);
        // await qualificationServices
        //   .databaseQualification(database, sse)
        //   .then(async (data) => {
        // await utilsForRegEx.addDomainsToValidAndInvalid(data).then((data) => {
        // res.status(200).send({
        //   data: database,
        // });
        //await utilsForRegEx.addDomainsToValidAndInvalid(data);
        // });
        //});
        // await utilsForRegEx.checkDomainType(emailsAfterRegex).then((data) => {
        //
        // });
      });
    });
  }
};
