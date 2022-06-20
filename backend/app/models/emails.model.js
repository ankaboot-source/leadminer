const redis = require("redis");
const dnsHelpers = require("../utils/dnsHelpers");
// initialise sse (server sent events)
const client = redis.createClient(6379);
client.connect();
/* A function that returns a sequelize model. */
module.exports = (sequelize, Sequelize) => {
  const EmailsInfos = sequelize.define("emails_info", {
    messageId: {
      allowNull: false,
      type: Sequelize.ARRAY(Sequelize.STRING),
    },
    address: {
      type: Sequelize.STRING,
      unique: true,
    },
    name: {
      type: Sequelize.STRING,
    },
    fields: {
      type: Sequelize.JSONB,
    },
    engagement: {
      type: Sequelize.SMALLINT,
    },
    date: {
      type: Sequelize.STRING,
    },
    validity: {
      type: Sequelize.STRING,
    },
    type: {
      type: Sequelize.ARRAY(Sequelize.STRING),
    },
  });
  // beforeBulkCreate will store records after dns check
  EmailsInfos.beforeBulkCreate(async (emails, options) => {
    let emailsBeStored = [];
    let promises = [];
    emails.map(async (email) => {
      promises.push(
        new Promise(async (resolve, reject) => {
          email["validity"] = "";
          const domain = email.address.split("@")[1];
          let dnsAddressCheckRedis = await client.get(domain);
          if (dnsAddressCheckRedis) {
            email.validity = "ok";
            emailsBeStored.push(email);
            resolve();
          } else {
            let dnsAddressCheckDns = await dnsHelpers.checkDNS(domain, client);
            if (dnsAddressCheckDns) {
              email.validity = dnsAddressCheckDns;
              emailsBeStored.push(email);
              resolve();
            } else {
              resolve();
            }
          }
        })
      );
    });
    Promise.all(promises).then(() => {
      emails = emailsBeStored;
      options.updateOnDuplicate.push("validity");
    });
  });
  return EmailsInfos;
};
