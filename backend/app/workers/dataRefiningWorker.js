const { parentPort } = require('worker_threads');
const minedDataHelpers = require('../utils/minedDataHelpers');
const redisClientForNormalMode =
  require('../../redis').redisClientForNormalMode();

/* Listening for a message event from the parent thread.
 *  This worker is used to refine data stored in the database then
 *  post the refined data to the main event loop so we can stream it
 */
parentPort.on('message', (userId) => {
  // Get all mined emails (no duplicates, with aggregation view: minedDataHelpers.getEmails in /utils/minedDataHelpers)
  minedDataHelpers.getEmails(userId.userId).then((Data) => {
    minedDataHelpers.getCountDB(userId.userId).then(async (totalScanned) => {
      // Sort data (alphabetic sorting, remove duplicated,null Names...)
      const sortedData = minedDataHelpers.sortDatabase(Data);
      // Sorted data
      const minedEmails = sortedData[0];
      // Count of transactional email addresses
      const transactional = sortedData[1];
      // COunt of the noReply emails
      const noReply = await minedDataHelpers.getNoReplyEmails(userId.userId);
      // Count of invalid email addresses
      const invalidDomain = await redisClientForNormalMode.scard(
        'invalidDomainEmails'
      );
      const data = {
        minedEmails,
        totalScanned,
        statistics: {
          noReply,
          invalidDomain,
          transactional
        }
      };
      // Send data to main process(main event loop)
      parentPort.postMessage(data);
    });
  });
});
