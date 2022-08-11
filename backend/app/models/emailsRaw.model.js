//const uuid = require('uuid');
module.exports = (sequelize, Sequelize) => {
  const EmailsRaw = sequelize.define('emails_raw', {
    email_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      allowNull: false,
      type: Sequelize.STRING,
    },
    from: { type: Sequelize.BOOLEAN },
    reply_to: { type: Sequelize.BOOLEAN },

    to: { type: Sequelize.BOOLEAN },

    cc: { type: Sequelize.BOOLEAN },

    bcc: { type: Sequelize.BOOLEAN },

    body: { type: Sequelize.BOOLEAN },

    name: { type: Sequelize.STRING, defaultValue: '' },
    address: { type: Sequelize.STRING },
    date: { type: Sequelize.STRING },
    transactional: { type: Sequelize.BOOLEAN },
    conversation: { type: Sequelize.INTEGER },
    newsletter: { type: Sequelize.BOOLEAN },
  });
  // EmailsRaw.associate = (models) => {
  //   EmailsRaw.belongsTo(models.Messages, {
  //     onDelete: "SET NULL",
  //     onUpdate: "CASCADE",
  //     foreignKey: {
  //       name: "message_id",
  //     },
  //   });
  // };
  // EmailsInfos.beforeBulkCreate(async (emails, options) => {
  //   emails.map(async (email) => {
  //     const domain = email.address.split("@")[1];
  //     console.log(domain);
  //     let dnsAddressCheckRedis = await client.get(domain);
  //     if (dnsAddressCheckRedis) {
  //       email.validity = dnsAddressCheckRedis;
  //     } else {
  //       let dnsAddressCheckDns = await dnsHelpers.checkDNS(domain, client);
  //       console.log(dnsAddressCheckDns);
  //       if (dnsAddressCheckDns) {
  //         email.validity = dnsAddressCheckDns;
  //       }
  //     }
  //   });
  //   options.updateOnDuplicate.push("validity");
  // });
  return EmailsRaw;
};
