const FIELDS = ["to", "from", "cc", "bcc", "reply-to"];
const regExHelpers = require("../utils/regexpUtils");
class EmailMessage {
  constructor(sequentialId, header, body) {
    this.sequentialId = sequentialId;
    this.header = header || {};
    this.body = body || {};
  }
  isNewsletter() {}
  isEmailConnection() {}
  isTransactional() {}
  isInConversation() {}
  isInvitation() {}
  hasAttachement() {}
  getSenderIp() {}
  getDate(metaDataProps) {
    return metaDataProps["date"];
  }
  getMessagingFieldsOnly() {
    let messagingProps = {};
    Object.keys(this.header).map((key) => {
      if (FIELDS.includes(key)) {
        messagingProps[key] = this.header[key][0];
      }
    });
    return messagingProps;
  }
  getOtherMetaDataFields() {
    let metaDataProps = {};
    Object.keys(this.header).map((key) => {
      if (!FIELDS.includes(key)) {
        metaDataProps[key] = this.header[key][0];
      }
    });
    return metaDataProps;
  }
  getMessageId() {
    return this.header["message-id"][0];
  }
  getSize() {}
  getEmailsObjectsFromHeader(messagingFields, metaDataProps) {
    let emailsObjects = [];
    Object.keys(messagingFields).map((key) => {
      let emails = regExHelpers.extractNameAndEmail(messagingFields[key]);
      emails.map((email) => {
        let emailObject = {};
        emailObject["messageId"] = this.getMessageId();
        emailObject["address"] = email.address;
        emailObject["name"] = email.name;
        emailObject["fields"] = {};
        emailObject["fields"][key] = 1;
        emailObject["date"] = this.getDate(metaDataProps);
        emailObject["type"] = "this.getEmailType()";
        emailsObjects.push(emailObject);
      });
    });
    return emailsObjects;
  }
  getEmailsObjectsFromBody() {
    let emailsObjects = [];
    let emailObject = {};
    let emails = regExHelpers.extractNameAndEmailFromBody(this.body);
    emails.map((email) => {
      emailObject["message-id"] = this.getMessageId();
      emailObject["address"] = email.address;
      emailObject["name"] = "";
      emailObject["fields"][body] = 1;
      emailObject["date"] = this.getDate(metaDataProps);
      emailObject["type"] = this.getEmailType();
      emailsObjects.push(emailObject);
    });

    return emailsObjects;
  }
  extractEmailObjectsFromHeader() {
    let messagingFields = this.getMessagingFieldsOnly();
    let metaDataProps = this.getOtherMetaDataFields();
    let emailsObjects = this.getEmailsObjectsFromHeader(
      messagingFields,
      metaDataProps
    );
    return emailsObjects;
  }
  extractEmailObjectsFromBody() {
    if (Object.keys(this.body).length > 0) {
      let emailsObjects = this.getEmailsObjectsFromBody(
        this.body.toString("utf8")
      );
      return emailsObjects;
    } else {
      return [];
    }
  }
  extractPhoneContact() {}
}
module.exports = EmailMessage;
