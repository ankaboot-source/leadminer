const utilsForRegEx = require("../utils/regexpUtils");
const utilsForDataManipulation = require("../utils/extractors");
const helpers = require("../utils/inputHelpers");
const logger = require("../utils/logger")(module);
const Imap = require("imap");
const simpleParser = require("mailparser").simpleParser;

function ScanFolders(chunk, bodiesTofetch, chunkSource, minedEmails) {
  // ensure that body scan is included (selected on RedisClient side)
  // &&
  // the current chunk is extracted from body
  if (bodiesTofetch.includes("1") && chunkSource.which == "1") {
    let body = utilsForRegEx.extractEmailsFromBody(chunk.toString("utf8"));

    if (body) {
      minedEmails.hasOwnProperty("body")
        ? minedEmails["body"].push(...body)
        : (minedEmails["body"] = body);
    }
  } else {
    // extract header attributes
    let header = Imap.parseHeader(chunk.toString("utf8"));
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
  bodiesTofetch,
  imapInfoEmail,
  RedisClient,
  sse,
  boxes,
  timer
) {
  if (currentbox) {
    console.log("sse");
    var sends = helpers.EqualPartsForSocket(currentbox.messages.total);
    const f = imap.seq.fetch("1:*", {
      bodies: bodiesTofetch,
      struct: true,
    });
    // callback for "message" emitted event
    f.on("message", (msg, seqno) => {
      if (sends.includes(seqno)) {
        sse.send(
          Math.round((seqno * 100) / currentbox.messages.total) / 100,
          "percentage"
        );
      }
      if (seqno == currentbox.messages.total) {
        sse.send(1, "percentage");
      }
      // callback for "body" emitted event
      let minedEmails = {};
      let bodyData = [];
      msg.on("body", async function (stream, streamInfo) {
        stream.on("data", (chunk) => {
          bodyData.push(
            ScanFolders(chunk, bodiesTofetch, streamInfo, minedEmails)
          );
        });
        // when fetching stream ends we process data
        stream.once("end", () => {
          minedEmails["body"] = [...new Set(minedEmails["body"])];
        });
      });
      msg.once("end", function () {
        if (minedEmails) {
          utilsForDataManipulation.treatParsedEmails(
            sse,
            minedEmails,
            database,
            RedisClient,
            imapInfoEmail,
            timer
          );
        }
      });
    });
    f.once("error", (err) => {
      ErrorOnFetch(err, imapInfoEmail);
    });
    f.once("end", () => {
      sse.send(1, "percentage");

      setTimeout(() => {
        sse.send(database, "data");
      }, 200);
      if (currentbox.name == boxes[boxes.length - 1]) {
        sse.send(database, "data");
        setTimeout(() => {
          sse.send(database, "data");
          database = null;
          imap.end();
        }, timer.time);
        setTimeout(() => {
          sse.send(true, "dns");
        }, timer.time + 1000);
      } else {
        store.box = boxes[boxes.indexOf(currentbox.name) + 1];
        sse.send(database, "data");
        sse.send(0, "percentage");
      }
    });
  }
}

function imapService(
  bodiesTofetch,
  boxes,
  imapInfo,
  RedisClient,
  sse,
  query,
  res
) {
  const imap = new Imap({
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
  imap.connect();
  logger.info(
    `Begin collecting emails from imap account with email : ${imapInfo.email}`
  );
  var database = [];

  const ProxyChange = {
    set: function (target, key, value) {
      return Reflect.set(...arguments);
    },
  };
  const timer = new Proxy({ time: 9000 }, ProxyChange);

  imap.once("ready", async () => {
    const loopfunc = (box) => {
      imap.openBox(box, true, async (err, currentbox) => {
        sse.send(box, "box");
        OpenedBoxCallback(
          store,
          database,
          imap,
          currentbox,
          bodiesTofetch,
          imapInfo.email,
          RedisClient,
          sse,
          boxes,
          timer
        );
      });
    };
    let validator = {
      set: function (target, key, value) {
        loopfunc(value);
        return true;
      },
    };
    let store = new Proxy({}, validator);
    if (store.box) {
      loopfunc(store.box);
    } else {
      loopfunc(boxes[0]);
    }
  });
  imap.once("error", function (err) {
    logger.info(
      `Error occured when collecting emails from imap account with email : ${imapInfo.email}`
    );
    res.status(500).send({
      message: "Error when fetching emails.",
    });
  });

  imap.once("end", function () {
    logger.info(
      `End collecting emails from imap account with email : ${imapInfo.email}`
    );
    res.status(200).send({
      message: "Done fetching emails !",
    });
  });
}
exports.imapService = imapService;
