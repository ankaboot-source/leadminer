/* istanbul ignore file */
const utilsForRegEx = require("../utils/regexpUtils");
const utilsForDataManipulation = require("../utils/extractors");
const helpers = require("../utils/inputHelpers");
const logger = require("../utils/logger")(module);
const Imap = require("imap");
const xoauth2 = require("xoauth2");
const { fork } = require("child_process");
function ScanFolders(chunk, bodiesTofetch, chunkSource, minedEmails) {
  // ensure that body scan is included (selected on RedisClient side)
  // &&
  // the current chunk is extracted from body
  if (bodiesTofetch.includes("1") && chunkSource.which == "1") {
    const body = utilsForRegEx.extractEmailsFromBody(chunk.toString("utf8"));
    if (body) {
      Object.prototype.hasOwnProperty.call(minedEmails, "body")
        ? minedEmails["body"].push(...body)
        : (minedEmails["body"] = body);
    }
  } else {
    // extract header attributes
    const header = Imap.parseHeader(chunk.toString("utf8"));
    Object.keys(header).map((field) => {
      minedEmails[field] = header[field];
    });
  }
}
function ErrorOnFetch(err, imapInfoEmail) {
  logger.error(
    `Error occured when collecting emails from imap account with email : ${imapInfoEmail}`
  );
}
async function OpenedBoxCallback(
  store,
  database,
  imap,
  currentbox,
  box,
  bodiesTofetch,
  imapInfoEmail,
  RedisClient,
  sse,
  boxes,
  timer,
  tempValidDomain,
  query,
  req
) {
  if (currentbox) {
    const sends = helpers.EqualPartsForSocket(currentbox.messages.total);
    const sendsForData = helpers.EqualPartsForSocket(
      currentbox.messages.total % 3
    );
    const f = imap.seq.fetch("1:*", {
      bodies: bodiesTofetch,
      struct: true,
    });

    timer.totalEmails += currentbox.messages.total;

    // callback for "message" emitted event
    f.on("message", (msg, seqno) => {
      timer.scannedEmails += 1;

      if (
        (sends.includes(seqno) || sendsForData.includes(seqno)) &&
        currentbox.messages.total > 0
      ) {
        sse.send(timer.scannedEmails, `scanned${query.userId}`);
        sse.send(timer.totalEmails, `total${query.userId}`);
        sse.send(helpers.sortDatabase(database), "data" + query.userId);
      }

      const minedEmails = {};
      const bodyData = [];
      let buff = "";
      msg.on("body", async function (stream, streamInfo) {
        stream.on("data", (chunk) => {
          // req.on("close", () => {
          //   console.log("endd");
          //   imap.end();
          // });
          buff += chunk.toString("utf8");
        });
        // when fetching stream ends we process data
        stream.once("end", () => {
          bodyData.push(
            ScanFolders(buff, bodiesTofetch, streamInfo, minedEmails)
          );
          minedEmails["body"] = [...new Set(minedEmails["body"])];
        });
      });
      msg.once("end", function () {
        if (minedEmails) {
          utilsForDataManipulation.treatParsedEmails(
            minedEmails,
            database,
            RedisClient,
            imapInfoEmail,
            timer,
            tempValidDomain,
            req
          );
        }
      });
    });
    f.once("error", (err) => {
      ErrorOnFetch(err, imapInfoEmail);
    });
    f.once("end", () => {
      //sse.send(1, "percentage" + query.userId);
      sse.send(timer.scannedEmails, `scanned${query.userId}`);

      sse.send(timer.totalEmails, `total${query.userId}`);

      // setTimeout(() => {
      //   sse.send(helpers.sortDatabase(database), "data" + query.userId);
      // }, 200);
      if (currentbox.name == boxes[boxes.length - 1]) {
        sse.send(timer.totalEmails, `total${query.userId}`);
        // sse.send(helpers.sortDatabase(database), "data" + query.userId);

        // setTimeout(() => {
        //   sse.send(helpers.sortDatabase(database), "data" + query.userId);
        //   database = null;

        //   imap.end();
        // }, timer.time);
        setTimeout(() => {
          sse.send(true, "dns" + query.userId);
        }, timer.time + 100);
      } else {
        store.box = boxes[boxes.indexOf(currentbox.name) + 1];
        sse.send(helpers.sortDatabase(database), "data" + query.userId);
        //sse.send(0, "percentage" + query.userId);
      }
    });
  } else {
    if (boxes[boxes.indexOf(box) + 1]) {
      store.box = boxes[boxes.indexOf(box) + 1];
    } else {
      sse.send(helpers.sortDatabase(database), "data" + query.userId);
      sse.send(true, "dns" + query.userId);
      imap.end();
    }
  }
}

function imapService(
  bodiesTofetch,
  boxes,
  imapInfo,
  RedisClient,
  sse,
  query,
  res,
  req
) {
  let imapInfoEmail;
  let imap;
  //console.log(query);
  if (query.token == "") {
    console.log(query);
    imap = new Imap({
      user: imapInfo.email,
      password: query.password,
      host: imapInfo.host,
      port: imapInfo.port,
      tls: true,
      connTimeout: 20000,
      authTimeout: 7000,
      tlsOptions: {
        port: 993,
        host: imapInfo.host,
        servername: imapInfo.host,
      },
    });
    imapInfoEmail = imapInfo.email;
  } else {
    imapInfoEmail = query.userEmail;
    const xoauth2gen = xoauth2.createXOAuth2Generator({
      user: query.userEmail,
      clientId: process.env.GG_CLIENT_ID,
      clientSecret: process.env.GG_CLIENT_SECRET,
      accessToken: query.token,
    });

    const authData = `user=${query.userEmail}\x01auth=Bearer ${xoauth2gen.accessToken}\x01\x01`;
    const xoauth2_token = new Buffer.from(authData, "utf-8").toString("base64");
    imap = new Imap({
      user: query.userEmail,
      xoauth2: xoauth2_token,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: {
        port: 993,
        host: "imap.gmail.com",
        servername: "imap.gmail.com",
      },
      keepalive: false,
    });
  }
  imap.connect();
  logger.info(
    `Begin collecting emails from imap account with email : ${imapInfo.email}`
  );
  const database = [];
  // eslint-disable-line
  const ProxyChange = {
    // eslint-disable-line
    set: function (target, key, value) {
      return Reflect.set(...arguments);
    },
  };
  const timer = new Proxy(
    { time: 1000, totalEmails: 0, scannedEmails: 0 },
    ProxyChange
  );
  const tempValidDomain = [];
  imap.once("ready", async () => {
    let forceEnd = false;
    if (forceEnd == true) {
      imap.connect();
    }
    req.on("close", () => {
      forceEnd = true;
    });
    const loopfunc = (box) => {
      imap.openBox(box, true, async (err, currentbox) => {
        OpenedBoxCallback(
          store,
          database,
          imap,
          currentbox,
          box,
          bodiesTofetch,
          imapInfoEmail,
          RedisClient,
          sse,
          boxes,
          timer,
          tempValidDomain,
          query,
          req
        );
      });
    };
    const validator = {
      set: function (target, key, value) {
        loopfunc(value);
        return true;
      },
    };
    const store = new Proxy({}, validator);
    if (store.box) {
      loopfunc(store.box);
    } else {
      loopfunc(boxes[0]);
    }
  });

  imap.once("error", function (err) {
    logger.error(
      `Error occured when collecting emails from imap account with email : ${err} ${imapInfo.email}`
    );
    res.status(500).send({
      message: "Error when fetching emails.",
    });
  });

  imap.once("end", function () {
    sse.send(helpers.sortDatabase(database), "data" + query.userId);
    sse.send(true, "dns" + query.userId);
    logger.info(
      `End collecting emails from imap account with email : ${imapInfo.email}`
    );
    res.status(200).send({
      message: "Done mining emails !",
    });
  });
}
exports.imapService = imapService;
