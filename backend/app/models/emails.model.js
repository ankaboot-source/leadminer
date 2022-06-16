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
    // msgId: {
    //   type: Sequelize.ARRAY(Sequelize.INTEGER),
    // },
    // folder: {
    //   type: Sequelize.ARRAY(Sequelize.STRING),
    // },
    date: {
      type: Sequelize.STRING,
    },
    validity: {
      type: Sequelize.STRING,
    },
    // total: {
    //   type: Sequelize.INTEGER,
    // },
    type: {
      type: Sequelize.STRING,
    },
  });
  // EmailsInfos.associate = (models) => {
  //   EmailsInfos.belongsTo(models.imap_infos, {
  //     foreignKey: "userId",
  //   });
  // };
  EmailsInfos.beforeBulkCreate(async (emails, options) => {
    emails.map(async (email) => {
      const domain = email.address.split("@")[1];
      console.log(domain);
      let dnsAddressCheckRedis = await client.get(domain);
      if (dnsAddressCheckRedis) {
        email.validity = dnsAddressCheckRedis;
      } else {
        let dnsAddressCheckDns = await dnsHelpers.checkDNS(domain, client);
        console.log(dnsAddressCheckDns);
        if (dnsAddressCheckDns) {
          email.validity = dnsAddressCheckDns;
        }
      }
    });
    options.updateOnDuplicate.push("validity");
  });
  return EmailsInfos;
};
