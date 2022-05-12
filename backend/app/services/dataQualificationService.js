const utils = require('../utils/regexpUtils');
const { emailsInfos } = require('../models');
const logger = require('../utils/logger')(module);
const { Op } = require('sequelize');
async function databaseQualification(data, sse) {
  // detect regEx in data
  const dataAfterRegEx = await utils.detectRegEx(data);
  // Check domain type (using dns module resolveMx)
  const dataAfterCheckDomain = dataAfterRegEx;
  const dataAfterCheckDomain1 = dataAfterCheckDomain;
  const promises = [];
  const dataToBe = [];
  function removeDuplicates(originalArray, prop) {
    const newArray = [];
    const lookupObject = {};

    for (const i in originalArray) {
      lookupObject[originalArray[i][prop]] = originalArray[i];
    }

    for (const i in lookupObject) {
      newArray.push(lookupObject[i]);
    }
    return newArray;
  }
  dataAfterCheckDomain.map((val) => {
    sse.send('Updating database', 'status');
    dataAfterCheckDomain.forEach((emo) => {
      if (val.email.address == emo.email.address && val.field == emo.field) {
        const count = dataAfterCheckDomain1.filter(
          (obj) =>
            typeof obj.email !== 'undefined' &&
            obj.email.address === val.email.address &&
            obj.field == val.field
        ).length;
        if (Array.isArray(val.field)) {
          val.field.push([val.field, count]);
        } else {
          val.field = [val.field, count];
        }
      }
    });
  });

  // loop through collected data and update database with new changes
  dataAfterCheckDomain.forEach(async (data) => {
    const count = dataAfterCheckDomain1.filter(
      (obj) =>
        typeof obj.email !== 'undefined' &&
        obj.email.address === data.email.address
    ).length;
    data['total'] = count;
    const countd = dataAfterCheckDomain1.filter(
      (obj) =>
        typeof obj.email !== 'undefined' &&
        obj.email.address === data.email.address &&
        obj.field[0] === data.field[0]
    ).length;
    data.field[1] = countd;

    // find one record thet matches the current email object(data)
    emailsInfos
      .findOne({
        where: {
          'email.address': {
            [Op.eq]: data.email.address,
          },
        },
      })
      .then(async (message) => {
        if (message != null) {
          if (!message.msgId.includes(data.msgId)) {
            message.msgId.push(data.msgId);
          } else if (!message.field.includes(data.field)) {
            message.field.push(data.field);
          } else if (!message.folder.includes(data.folder)) {
            message.folder.push(data.folder);
          }
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
                  'email.address': {
                    [Op.eq]: data.email.address,
                  },
                },
              }
            )
          );
        } else {
          const EmailReadyTobeStored = {
            email: data.email,
            field: [data.field],
            msgId: [data.msgId],
            folder: [data.folder],
            type: 'email header',
            dnsValidity: data.dnsValidity,
            total: data.total,
          };
          dataToBe.push(EmailReadyTobeStored);
          await emailsInfos.create(EmailReadyTobeStored);
        }
      });
    logger.info('done fetching and updating data');
  });
  const alldata = await emailsInfos.findAll();
  const arra = [];

  const ele1 = dataAfterCheckDomain.filter(
    (value, index, self) =>
      index ===
      self.findIndex(
        (t) =>
          t.email.address === value.email.address &&
          t.field[0] === value.field[0]
      )
  );
  let ar = [];
  ele1.map((value) => {
    ele1.map((data) => {
      if (
        data.email.address == value.email.address &&
        !data.field.every((el) => value.field.includes(el))
      ) {
        value.field = [data.field, value.field];
      }
    });
  });
  ar = ele1.filter(
    (value, index, self) =>
      index === self.findIndex((t) => t.email.address === value.email.address)
  );
  sse.send('Domain check', 'status');

  const dataAfterCheckDomain3 = await utils.checkDomainType(ar);

  return dataAfterCheckDomain3;
}

exports.databaseQualification = databaseQualification;
