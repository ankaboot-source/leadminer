const helpers = require("../utils/inputHelpers");
const { parentPort, workerData, isMainThread } = require("worker_threads");
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
          const worker = new Worker("./app/services/child.js", {
            workerData: {
              minedEmails,
            },
          });
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
if (!isMainThread) {
  // make sure we got an array of data
  if (!Array.isArray(workerData)) {
    // we can throw an error to emit the "error" event from the worker
    throw new Error("workerData must be an array of numbers");
  }
  // we post a message through the parent port, to emit the "message" event
  OpenedBoxCallback(workerData);
}
