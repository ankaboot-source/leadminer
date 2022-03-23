const utils = require("../utils/regexp");
const { emailsInfos } = require("../models");
const logger = require("../utils/logger")(module);
const { Op } = require("sequelize");
async function databaseQualification(data, currentFolders) {
  // detect regEx in data
  let dataAfterRegEx = await utils.detectRegEx(data);
  console.log(dataAfterRegEx);

  // Check domain type (using dns module resolveMx)
  let dataAfterCheckDomain = await utils.checkDomainType(dataAfterRegEx);
  //console.log(datadomain);
  console.log(dataAfterCheckDomain);
  // count all occurences if each message
  // dataAfterCheckDomain.forEach((email) => {
  //   // get count occurences for each email in the list
  //   let count = dataAfterCheckDomain.filter(
  //     (obj) => obj.email.address === email.email.address
  //   ).length;
  //   email["total"] = count;
  // });
  const promises = [];
  let dataToBe = [];
  // loop through collected data and update database with new changes
  dataAfterCheckDomain.forEach(async (data) => {
    let count = dataAfterCheckDomain.filter(
      (obj) => obj.email.address === data.email.address
    ).length;
    data["total"] = count;
    // find one record thet matches the current email object(data)
    emailsInfos
      .findOne({
        where: {
          "email.address": {
            [Op.eq]: data.email.address,
          },
        },
      })
      .then(async (message) => {
        console.log(message);
        if (message != null) {
          //console.log(message);
          if (!message.msgId.includes(data.msgId)) {
            message.msgId.push(data.msgId);
            console.log(message.msgId);
          } else if (!message.field.includes(data.field)) {
            message.field.push(data.field);
            console.log(message.field);
          } else if (!message.folder.includes(data.folder)) {
            message.folder.push(data.folder);
          }
          //console.log(message);

          promises.push(
            emailsInfos.update(
              {
                msgId: message.msgId,
                folder: message.folder,
                field: message.field,
                dnsValidity: data.dnsValidity,
                total: data.total,
              },
              {
                where: {
                  "email.address": {
                    [Op.eq]: data.email.address,
                  },
                },
              }
            )
          );
        } else {
          let EmailReadyTobeStored = {
            email: data.email,
            field: [data.field],
            msgId: [data.msgId],
            folder: [data.folder],
            type: "email header",
            dnsValidity: data.dnsValidity,
            total: data.total,
          };
          dataToBe.push(EmailReadyTobeStored);
          await emailsInfos.create(EmailReadyTobeStored);
        }
      });
    logger.info("done fetching and updating data");
  });
  //console.log(currentFolders);

  await Promise.all(promises);
  let alldata = await emailsInfos.findAll();
  console.log(JSON.parse(JSON.stringify(alldata)));
  //console.log(JSON.parse(JSON.stringify(alldata)));
  return dataAfterCheckDomain;
}

exports.databaseQualification = databaseQualification;
