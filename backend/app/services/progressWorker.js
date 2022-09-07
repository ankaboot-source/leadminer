const { parentPort } = require("worker_threads");
const databaseHelpers = require("../utils/databaseHelpers");
const inputHelpers = require("../utils/inputHelpers");
// get data from parent
parentPort.on("message", async (userId) => {
  const minedEmails = await databaseHelpers.getEmails(userId);
  const totalScanned = await databaseHelpers.getCountDB(userId);
  const data = inputHelpers.sortDatabase(minedEmails);
  parentPort.postMessage({ data: data, totalScanned: totalScanned });
});
