/* istanbul ignore file */
const utilsForRegEx = require("../utils/regexpUtils");
const utilsForDataManipulation = require("../utils/extractors");
const utilsForToken = require("../utils/tokenHelpers");
const helpers = require("../utils/inputHelpers");
const logger = require("../utils/logger")(module);
const Imap = require("imap");
const GOOGLE_IMAP_HOST = process.env.GOOGLE_IMAP_HOST;

function ScanFolders(chunk, bodiesTofetch, chunkSource, minedEmails) {
  // ensure that body scan is included (selected on RedisClient side)
  // &&
  // the current chunk is extracted from body
  if (bodiesTofetch.includes("1") && chunkSource.which == "1") {
    const body = utilsForRegEx.extractEmailsFromBody(chunk);
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
    const sends = helpers.EqualPartsForSocket(currentbox.messages.total);
    const f = imap.seq.fetch("1:*", {
      bodies: bodiesTofetch,
      struct: true,
    });

    // callback for "message" emitted event
    f.on("message", (msg, seqno) => {
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
          `minedEmailsAndScannedEmails${query.user.id}`
        );
        console.log(
          seqno -
            (sends[sends.indexOf(seqno) - 1]
              ? sends[sends.indexOf(seqno) - 1]
              : 0)
        );
      }
      // callback for "body" emitted event
      const minedEmails = {};

      msg.on("body", async function (stream, streamInfo) {
        let buff = "";
        stream.on("data", (chunk) => {
          buff += chunk;
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
            isScanned,
            { box: currentbox.name, seqno: seqno }
          );
        }
      });
    });

    f.once("end", () => {
      logger.info(
        `End mining emails from folder: ${currentbox.name} , User : ${imapInfoEmail}`
      );
      sse.send(currentbox.name, `scannedBoxes${query.user.id}`);
      // all folders are mined
      if (currentbox.name == boxes[boxes.length - 1]) {
        sse.send(helpers.sortDatabase(database), `data${query.user.id}`);
        sse.send(true, `dns${query.user.id}`);
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
      sse.send(true, `dns${query.user.id}`);
      imap.end();
    }
  }
}

async function imapService(
  bodiesTofetch,
  boxes,
  user,
  RedisClient,
  sse,
  query,
  res,
  req
) {
  let imapInfoEmail;
  let imap;
  let tokens;
  const tempArrayValid = [];
  const tempArrayInValid = [];
  const isScanned = [];

  if (!user.access_token) {
    imap = new Imap({
      user: user.email,
      password: query.password,
      host: user.host,
      port: user.port,
      tls: true,
      connTimeout: 20000,
      keepalive: false,
      authTimeout: 7000,
      tlsOptions: {
        port: 993,
        host: user.host,
        servername: user.host,
      },
    });
    imapInfoEmail = user.email;
  } else {
    imapInfoEmail = user.email;

    tokens = await utilsForToken.generateXOauthToken(
      user.access_token,
      user,
      user.refreshToken
    );
    sse.send(tokens.newToken, "token" + query.user.id);
    imap = new Imap({
      user: user.email,
      xoauth2: tokens.xoauth2Token,
      host: GOOGLE_IMAP_HOST,
      port: 993,
      tls: true,
      tlsOptions: {
        port: 993,
        host: GOOGLE_IMAP_HOST,
        servername: GOOGLE_IMAP_HOST,
      },
      keepalive: false,
    });
  }
  imap.connect();
  logger.info(`Begin collecting emails from imap account with id : ${user.id}`);
  query.user = JSON.parse(query.user);

  const database = [];
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
    sse.send(helpers.sortDatabase(database), "data" + user.id);
    sse.send(true, `dns${user.id}`);

    logger.info(`Connection Closed (maybe by the user) : ${user.id}`);
  });

  imap.once("error", function (err) {
    logger.error(
      `Error occured when collecting emails fro account with id : ${err} ${user.id}`
    );
  });

  imap.once("end", function () {
    logger.info(
      `End collecting emails for account with id : ${user.id}, mined : ${database.length} email addresses`
    );
    const data = helpers.sortDatabase(database);

    sse.send(data, `data${user.id}`);
    sse.send(true, `dns${user.id}`);
    setTimeout(() => {
      res.status(200).send({
        message: "Done mining emails !",
      });
    }, 1200);
  });
}
exports.imapService = imapService;
