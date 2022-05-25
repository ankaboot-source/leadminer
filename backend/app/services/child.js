const helpers = require("../utils/inputHelpers");
const OpenedBoxCallback = async (
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
) => {
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

      setTimeout(() => {
        sse.send(helpers.sortDatabase(database), "data" + query.userId);
      }, 200);
      if (currentbox.name == boxes[boxes.length - 1]) {
        sse.send(timer.totalEmails, `total${query.userId}`);
        sse.send(helpers.sortDatabase(database), "data" + query.userId);

        setTimeout(() => {
          sse.send(helpers.sortDatabase(database), "data" + query.userId);
          database = null;
          imap.end();
        }, timer.time);
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
};

process.on("message", (message) => {
  let store = message.store;
  let database = message.database;
  let imap = message.imap;
  let currentbox = message.currentbox;
  let box = message.box;
  let bodiesTofetch = message.bodiesTofetch;
  let imapInfoEmail = message.imapInfoEmail;
  let RedisClient = message.RedisClient;
  let sse = message.sse;
  let boxes = message.boxes;
  let timer = message.timer;
  let tempValidDomain = message.tempValidDomain;
  let query = message.query;
  let req = message.req;
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
