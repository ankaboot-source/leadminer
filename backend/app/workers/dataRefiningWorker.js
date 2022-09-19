//this is a worker to handle the messages
const { parentPort } = require("worker_threads");
const minedDataHelpers = require("../utils/minedDataHelpers");
const redisClient = require("../../redis");

/* Listening for a message from the parent thread. */
parentPort.on("message", (userId) => {
  minedDataHelpers.getEmails(userId.userId).then((Data) => {
    minedDataHelpers.getCountDB(userId.userId).then(async (totalScanned) => {
      const sortedData = minedDataHelpers.sortDatabase(Data);
      const minedEmails = sortedData[0];
      const transactional = sortedData[1];
      const noReply = await minedDataHelpers.getNoReplyEmails(userId.userId);
      console.log(noReply);
      //const noReply = await redisClient.get('noReply');
      const invalidDomain = await redisClient.scard("invalidDomainEmails");
      let data = {
        minedEmails: minedEmails,
        totalScanned: totalScanned,
        statistics: {
          noReply: noReply,
          invalidDomain: invalidDomain,
          transactional: transactional,
        },
      };
      parentPort.postMessage(data);
    });
  });
});
