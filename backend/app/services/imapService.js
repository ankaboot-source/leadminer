/* istanbul ignore file */
const utilsForRegEx = require("../utils/regexpUtils");
const utilsForDataManipulation = require("../utils/extractors");
const helpers = require("../utils/inputHelpers");
const logger = require("../utils/logger")(module);
const Imap = require("imap");
const xoauth2 = require("xoauth2");

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
  query,
  req,
  counter,
  tempArrayValid,
  tempArrayInValid,
  isScanned
) {
  if (currentbox) {
    logger.info(
      `Begin mining emails from folder: ${currentbox.name} , User : ${imapInfoEmail} , box length : ${currentbox.messages.total}`
    );
    sse.send(currentbox.messages.total, `total${query.userId}`);
    let sends = helpers.EqualPartsForSocket(currentbox.messages.total);
    const f = imap.seq.fetch("1:*", {
      bodies: bodiesTofetch,
      struct: true,
    });

    // callback for "message" emitted event
    f.on("message", (msg, seqno) => {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      console.log(
        `The script uses approximately ${Math.round(used * 100) / 100} MB`
      );
      if (sends.includes(seqno) && currentbox.messages.total > 0) {
        sse.send(
          {
            data: helpers.sortDatabase(database),
            scanned:
              seqno -
              (sends[sends.indexOf(seqno) - 1]
                ? sends[sends.indexOf(seqno) - 1]
                : 0),
            invalid: counter.invalidAddresses,
          },
          "minedEmailsAndScannedEmails" + query.userId
        );
      }
      // callback for "body" emitted event
      const minedEmails = {};

      msg.on("body", async function (stream, streamInfo) {
        let buff = "";
        stream.on("data", (chunk) => {
          buff += chunk.toString("utf8");
        });
        // when fetching stream ends we process data
        stream.once("end", () => {
          ScanFolders(buff, bodiesTofetch, streamInfo, minedEmails);
          minedEmails["body"] = [...new Set(minedEmails["body"])];
        });
      });

      msg.once("end", function () {
        if (Object.keys(minedEmails).length > 0) {
          utilsForDataManipulation.treatParsedEmails(
            minedEmails,
            database,
            RedisClient,
            imapInfoEmail,
            counter,
            tempArrayValid,
            tempArrayInValid,
            isScanned
          );
        }
      });
    });

    f.once("end", () => {
      logger.info(
        `End mining emails from folder: ${currentbox.name} , User : ${imapInfoEmail}`
      );
      sse.send(currentbox.name, `scannedBoxes${query.userId}`);
      // all folders are mined
      if (currentbox.name == boxes[boxes.length - 1]) {
        sse.send(helpers.sortDatabase(database), "data" + query.userId);
        sse.send(true, "dns" + query.userId);

        imap.end();
      } else {
        store.box = boxes[boxes.indexOf(currentbox.name) + 1];
      }
    });
  } // A parent folder but undefined eg: [Gmail]
  else {
    if (boxes[boxes.indexOf(box) + 1]) {
      store.box = boxes[boxes.indexOf(box) + 1];
    } else {
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
  let tempArrayValid = [];
  let tempArrayInValid = [];
  let isScanned = [];
  if (query.token == "") {
    imap = new Imap({
      user: imapInfo.email,
      password: query.password,
      host: imapInfo.host,
      port: imapInfo.port,
      tls: true,
      connTimeout: 20000,
      keepalive: false,
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
  const tempValidDomain = [];
  imap.once("ready", async () => {
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
          query,
          req,
          counter,
          tempArrayValid,
          tempArrayInValid,
          isScanned
        );
      });
    };
    const ProxyChange = {
      // eslint-disable-line
      set: function (target, key, value) {
        return Reflect.set(...arguments);
      },
    };
    const counter = new Proxy({ invalidAddresses: 0 }, ProxyChange);
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
  //connextion xlosed (end or by user)
  req.on("close", () => {
    imap.destroy();
    imap.end();
    //sse.send(helpers.sortDatabase(database), "data" + query.userId);
    sse.send(true, "dns" + query.userId);

    logger.info(`Connection Closed (maybe by the user) : ${imapInfo.email}`);
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
    let data = helpers.sortDatabase(database);
    sse.send(data, "data" + query.userId);
    sse.send(true, "dns" + query.userId);
    logger.info(
      `End collecting emails from imap account with email : ${imapInfo.email}, mined : ${database.length} email addresses`
    );

    res.status(200).send({
      message: "Done mining emails !",
    });
  });
}
exports.imapService = imapService;
