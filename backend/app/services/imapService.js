const utilsForRegEx = require("../utils/regexp");
const utilsForDataManipulation = require("../utils/extractors");
const logger = require("../utils/logger")(module);
const Imap = require("imap");
const { Console } = require("winston/lib/winston/transports");

function ScanFolders(chunk, bodiesTofetch, chunkSource) {
  // ensure that body scan is included (selected on RedisClient side)
  // &&
  // the current chunk is extracted from body
  //console.log(chunk);
  let minedEmails = {};
  //console.log(chunkSource);
  if (bodiesTofetch.includes("1") && chunkSource.which == "1") {
    let body = utilsForRegEx.extractEmailsFromBody(chunk.toString());
    if (body) {
      minedEmails["body"] = body;
    }
  } else {
    // extract header attributes
    minedEmails = Imap.parseHeader(chunk.toString("utf8"));
    //console.log(minedEmails);
  }
  return minedEmails;
}
function ErrorOnFetch(err, imapInfoEmail) {
  logger.error(
    `Error occured when collecting emails from imap account with email : ${imapInfoEmail}`
  );
  //   res.status(500).send({
  //     error: err,
  //   });
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
  boxes
) {
  //console.log(currentbox);
  if (currentbox) {
    console.log("sse");
    var sends = utilsForRegEx.EqualPartsForSocket(currentbox.messages.total);
    const f = imap.seq.fetch("1:*", {
      bodies: bodiesTofetch,
      struct: true,
    });
    // callback for "message" emitted event
    f.on("message", (msg, seqno) => {
      //console.log(seqno);
      if (sends.includes(seqno)) {
        //sse.send(currentbox.name, "box");sse.send(database, "data");
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
      msg.on("body", async function (stream, streamInfo) {
        stream.on("data", (chunk) => {
          minedEmails = {
            ...minedEmails,
            ...ScanFolders(chunk, bodiesTofetch, streamInfo),
          };
          //console.log(minedEmails, "mineeeeeeeeeeeeeeeeee/**/***");
        });
        // when fetching stream ends we process data
        stream.once("end", () => {
          if (minedEmails) {
            utilsForDataManipulation.treatParsedEmails(
              sse,
              minedEmails,
              database,
              RedisClient
            );
          }
        });
      });
      // message fetched
      // msg.once("end", function () {
      //   // send data to client
      //   if (sends.includes(seqno)) {
      //     sse.send(database, "data");
      //   }
      // });
    });
    f.once("error", (err) => {
      ErrorOnFetch(err, imapInfoEmail);
    });
    f.once("end", () => {
      console.log("h");
      sse.send(1, "percentage");
      setTimeout(() => {
        sse.send(database, "data");
      }, 3500);
      if (currentbox.name == boxes[boxes.length - 1]) {
        imap.end();
        setTimeout(() => {
          sse.send(true, "dns");
        }, 3500);
      } else {
        store.box = boxes[boxes.indexOf(currentbox.name) + 1];
        //console.log(store);
        sse.send(0, "percentage");
        return true;
        // i++;
        // loopfunc(boxes[i]);
      }
    });
  }
}
function imapService(bodiesTofetch, boxes, imapInfo, RedisClient, sse, query) {
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
  //const box = boxes[0];
  logger.info(
    `Begin collecting emails from imap account with email : ${imapInfo.email}`
  );
  let database = [],
    currentBox;

  imap.once("ready", async () => {
    const loopfunc = (box) => {
      //console.log(box);
      imap.openBox(box, true, async (err, currentbox) => {
        sse.send(box, "box");
        //console.log(currentBox, currentbox);
        OpenedBoxCallback(
          store,
          database,
          imap,
          currentbox,
          bodiesTofetch,
          imapInfo.email,
          RedisClient,
          sse,
          boxes
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

    //};
    //if (j == 0) {
    if (store.box) {
      loopfunc(store.box);
    } else {
      loopfunc(boxes[0]);
    }
    //}
  });
}
exports.imapService = imapService;
