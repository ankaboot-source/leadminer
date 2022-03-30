const utils = require("../utils/regexp");
const { emailsInfos } = require("../models");
const logger = require("../utils/logger")(module);
const { Op } = require("sequelize");
async function databaseQualification(data, sse) {
  // detect regEx in data
  let dataAfterRegEx = await utils.detectRegEx(data);
  //console.log(dataAfterRegEx);

  // Check domain type (using dns module resolveMx)
  let dataAfterCheckDomain = dataAfterRegEx; //await utils.checkDomainType(dataAfterRegEx);
  //console.log(datadomain);
  let dataAfterCheckDomain1 = dataAfterCheckDomain;
  // console.log(dataAfterCheckDomain);
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
  function removeDuplicates(originalArray, prop) {
    var newArray = [];
    var lookupObject = {};

    for (var i in originalArray) {
      lookupObject[originalArray[i][prop]] = originalArray[i];
    }

    for (i in lookupObject) {
      newArray.push(lookupObject[i]);
    }
    return newArray;
  }
  dataAfterCheckDomain.map((val) => {
    sse.send("Updating database", "status");
    dataAfterCheckDomain.forEach((emo) => {
      console.log("hello");
      if (val.email.address == emo.email.address && val.field == emo.field) {
        let count = dataAfterCheckDomain1.filter(
          (obj) =>
            typeof obj.email != "undefined" &&
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

  //console.log("uniqueArray is: " + JSON.stringify(uniqueArray));
  //dataAfterCheckDomain = uniqueArray;
  // loop through collected data and update database with new changes
  dataAfterCheckDomain.forEach(async (data) => {
    let count = dataAfterCheckDomain1.filter(
      (obj) =>
        typeof obj.email != "undefined" &&
        obj.email.address === data.email.address
    ).length;
    data["total"] = count;
    let countd = dataAfterCheckDomain1.filter(
      (obj) =>
        typeof obj.email != "undefined" &&
        obj.email.address === data.email.address &&
        obj.field[0] === data.field[0]
    ).length;
    data.field[1] = countd;

    //console.log(dataAfterCheckDomain);
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
        //console.log(message);
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

  //await Promise.all(promises);
  let alldata = await emailsInfos.findAll();
  //console.log(JSON.parse(JSON.stringify(alldata)));
  //console.log(JSON.parse(JSON.stringify(alldata)));
  let arra = [];

  let ele1 = dataAfterCheckDomain.filter(
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
  sse.send("Domain check", "status");

  let dataAfterCheckDomain3 = await utils.checkDomainType(ar);

  return dataAfterCheckDomain3;
}

exports.databaseQualification = databaseQualification;
