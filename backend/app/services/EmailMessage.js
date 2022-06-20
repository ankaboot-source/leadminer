const regExHelpers = require("../utils/regexpUtils");
const dateHelpers = require("../utils/dateHelpers");
const NEWSLETTER_HEADER_FIELDS = process.env.NEWSLETTER;
const TRANSACTIONAL_HEADER_FIELDS = process.env.TRANSACTIONAL;
const CAMPAIGN_HEADER_FIELDS = process.env.CAMPAIGN;
const FIELDS = ["to", "from", "cc", "bcc", "reply-to"];

class EmailMessage {
  /**
   * The constructor function is a function that is called when a new object is created.
   * @param sequentialId - The sequential id of the message.
   * @param header - This is a JSON object that contains the header information for the message.
   * @param body - The body of the message.
   */
  constructor(sequentialId, size, header, body) {
    this.sequentialId = sequentialId;
    this.size = size;
    this.header = header || {};
    this.body = body || {};
  }
  /**
   * If the header contains any of the fields in the NEWSLETTER_HEADER_FIELDS array, then return true
   * @returns True or False
   */
  isNewsletter() {
    return Object.keys(this.header).some((headerField) => {
      NEWSLETTER_HEADER_FIELDS.includes(headerField.toLowerCase());
    });
  }
  isEmailConnection() {}
  /**
   * It returns true if the email is transactional, and false if it's not
   * @returns A boolean value.
   */
  isTransactional() {
    return Object.keys(this.header).some((headerField) => {
      TRANSACTIONAL_HEADER_FIELDS.includes(headerField.toLowerCase());
    });
  }
  /**
   * If the header object has a key called "references", then return 1, otherwise return 0
   * @returns The function isInConversation() is returning a boolean value.
   */
  isInConversation() {
    if (Object.keys(this.header).includes("references")) {
      return 1;
    } else {
      return 0;
    }
  }
  getEmailType() {
    let type = [];
    if (this.isNewsletter()) {
      type.push("Newsletter");
    }
    if (this.isTransactional()) {
      type.push("Transactional");
    }
    return type;
    //if(this.is)
  }
  isInvitation() {}
  hasAttachement() {}
  getSenderIp() {}
  /**
   * It takes a metaDataProps object as an argument, and returns the value of the "date" property of that
   * object
   * @param metaDataProps - This is the metadata object that is passed to the function.
   * @returns The date of the article.
   */
  getDate() {
    return dateHelpers.parseDate(this.header?.date?.[0] ?? "");
  }
  /**
   * It returns an object with only the messaging fields from the header
   * @returns An object with only the messaging fields from the header.
   */
  getMessagingFieldsOnly() {
    let messagingProps = {};
    Object.keys(this.header).map((key) => {
      if (FIELDS.includes(key)) {
        messagingProps[key] = this.header[key][0];
      }
    });
    return messagingProps;
  }
  /**
   * It takes the header object and returns an object with all the properties that are not in the FIELDS
   * array
   * @returns An object with all the metadata fields that are not in the FIELDS array.
   */
  getOtherMetaDataFields() {
    let metaDataProps = {};
    Object.keys(this.header).map((key) => {
      if (!FIELDS.includes(key)) {
        metaDataProps[key] = this.header[key][0];
      }
    });
    return metaDataProps;
  }
  /**
   * It returns the message-id of the email
   * @returns The message-id of the email.
   */
  getMessageId() {
    if (this.header["message-id"]) {
      return this.header["message-id"][0];
    }
  }

  /**
   * It takes in an object of messaging fields and metadata properties, and returns an array of email
   * objects
   * @param messagingFields - an object with the keys being the messaging fields and the values being the
   * values of those fields.
   * @param metaDataProps - This is the metadata object that is passed to the function.
   * @returns An array of objects.
   */
  getEmailsObjectsFromHeader(messagingFields, metaDataProps) {
    let emailsObjects = [];
    Object.keys(messagingFields).map((key) => {
      let emails = regExHelpers.extractNameAndEmail(messagingFields[key]);
      if (emails) {
        emails.map((email) => {
          if (email) {
            if (email.address) {
              let emailObject = {};
              emailObject["messageId"] = [this.getMessageId()];
              emailObject["address"] = email.address;
              emailObject["name"] = email.name;
              emailObject["fields"] = {};
              emailObject["fields"][key] = 1;
              emailObject["date"] = this.getDate();
              emailObject["type"] = this.getEmailType();
              emailObject["engagement"] = this.isInConversation();
              emailsObjects.push(emailObject);
            }
          }
        });
      }
    });
    return emailsObjects;
  }
  /**
   * It takes the body of an email, extracts the email addresses from it, and returns an array of objects
   * that contain the email addresses and other information about the email
   * @returns An array of objects.
   */
  getEmailsObjectsFromBody() {
    let emailsObjects = [];
    let emailObject = {};
    let emails = regExHelpers.extractNameAndEmailFromBody(this.body);
    if (emails) {
      emails.map((email) => {
        if (email) {
          emailObject["messageId"] = [this.getMessageId()];
          emailObject["address"] = email;
          emailObject["name"] = "";
          emailObject["fields"] = {};
          emailObject["fields"]["body"] = 1;
          emailObject["date"] = this.getDate();
          emailObject["type"] = this.getEmailType();
          emailObject["engagement"] = this.isInConversation();
          emailsObjects.push(emailObject);
        }
      });
    }
    return emailsObjects;
  }
  /**
   * It takes the header, extracts the messaging fields, extracts the other metadata fields, and then
   * returns an array of objects that contain the email addresses and the metadata fields
   * @returns An array of objects.
   */
  extractEmailObjectsFromHeader() {
    let messagingFields = this.getMessagingFieldsOnly();
    let metaDataProps = this.getOtherMetaDataFields();
    let emailsObjects = this.getEmailsObjectsFromHeader(
      messagingFields,
      metaDataProps
    );
    return emailsObjects;
  }
  /**
   * It takes the body of the email, converts it to a string, and then uses a regular expression to
   * extract all the email addresses from the body
   * @returns An array of objects.
   */
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
