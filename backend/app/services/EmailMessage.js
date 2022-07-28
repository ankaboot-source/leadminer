const regExHelpers = require("../utils/regexpUtils");
const dateHelpers = require("../utils/dateHelpers");
const dataStructureHelpers = require("../utils/dataStructureHelpers");
const models = require("../models");
const { emailsRaw } = require("../models");
const logger = require("../utils/logger")(module);

const redisClient = require("../../redis");
const NEWSLETTER_HEADER_FIELDS = process.env.NEWSLETTER;
const TRANSACTIONAL_HEADER_FIELDS = process.env.TRANSACTIONAL;

//const CAMPAIGN_HEADER_FIELDS = process.env.CAMPAIGN;
const FIELDS = ["to", "from", "cc", "bcc", "reply-to"];

class EmailMessage {
  /**
   * The constructor function is a function that is called when a new object is created.
   * @param sequentialId - The sequential id of the message.
   * @param header - This is a JSON object that contains the header information for the message.
   * @param body - The body of the message.
   */
  constructor(sequentialId, size, header, body, user) {
    this.sequentialId = sequentialId;
    this.size = size;
    this.header = header || {};
    this.body = body || {};
    this.user = user;
  }

  async createMessage() {
    await redisClient.sAdd("messages", this.getMessageId());
    await models.Messages.create({
      message_id: this.getMessageId() + this.header["date"],
      isNewsletter: this.isNewsletter(),
      isTransactional: this.isTransactional(),
      isInConversation: this.isInConversation(),
    });

    return;
  }

  /**
   * If the header contains any of the fields in the NEWSLETTER_HEADER_FIELDS array, then return true
   * @returns True or False
   */
  isNewsletter() {
    return Object.keys(this.header).some((headerField) => {
      return NEWSLETTER_HEADER_FIELDS.includes(headerField.toLowerCase());
    });
  }
  isEmailConnection() {}
  /**
   * It returns true if the email is transactional, and false if it's not
   * @returns A boolean value.
   */
  isTransactional() {
    return Object.keys(this.header).some((headerField) => {
      return TRANSACTIONAL_HEADER_FIELDS.includes(headerField.toLowerCase());
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
    const type = [];
    if (this.isNewsletter()) {
      type.push("Newsletter");
    }
    if (this.isTransactional()) {
      type.push("Transactional");
    }
    return type;
  }

  isInvitation() {}
  hasAttachement() {}
  getSenderIp() {}
  extractPhoneContact() {}
  /**
   * It takes a metaDataProps object as an argument, and returns the value of the "date" property of that
   * object
   * @param metaDataProps - This is the metadata object that is passed to the function.
   * @returns The date of the article.
   */
  getDate() {
    if (this.header.date) {
      if (Date.parse(this.header.date[0])) {
        return this.header.date[0];
      } else {
        return "";
      }
    } else return "";
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
      return this.header["message-id"][0].substring(0, 60);
    } else {
      return `message_id_unknown ${this.header["date"]}`;
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
  async getEmailsObjectsFromHeader(messagingFields) {
    Object.keys(messagingFields).map(async (key) => {
      const emails = regExHelpers.extractNameAndEmail(messagingFields[key]);
      if (emails) {
        emails.map(async (email) => {
          if (email) {
            if (
              email.address &&
              this.user.email != email.address &&
              dataStructureHelpers.IsNotNoReply(email.address) &&
              dataStructureHelpers.checkDomainIsOk(email.address)
            ) {
              await emailsRaw.create({
                user_id: this.user.id,
                from: key == "from" ? true : false,
                reply_to: key == "reply-to" ? true : false,
                to: key == "to" ? true : false,
                cc: key == "cc" ? true : false,
                bcc: key == "bcc" ? true : false,
                date: this.getDate(),
                name: email?.name ?? "",
                address: email.address,
                newsletter:
                  key == "from" || key == "reply-to"
                    ? this.isNewsletter()
                    : false,
                transactional:
                  key == "from" || key == "reply-to"
                    ? this.isTransactional()
                    : false,
                conversation: this.isInConversation(),
              });
            }
          }
        });
      }
    });
    messagingFields = null;

    return;
  }
  /**
   * It takes the body of an email, extracts the email addresses from it, and returns an array of objects
   * that contain the email addresses and other information about the email
   * @returns An array of objects.
   */
  async getEmailsObjectsFromBody() {
    const emails = regExHelpers.extractNameAndEmailFromBody(
      this.body.toString("utf8")
    );
    if (emails) {
      emails.map(async (email) => {
        if (
          email &&
          this.user.email != email &&
          dataStructureHelpers.IsNotNoReply(email) &&
          dataStructureHelpers.checkDomainIsOk(email)
        ) {
          await emailsRaw.create({
            user_id: this.user.id,
            from: false,
            reply_to: false,
            to: false,
            cc: false,
            bcc: false,
            body: true,
            date: this.getDate(),
            name: "",
            address: email,
            newsletter: false,
            transactional: false,
            conversation: this.isInConversation(),
          });
        }
      });
    }
    return;
  }
  /**
   * It takes the header, extracts the messaging fields, extracts the other metadata fields, and then
   * returns an array of objects that contain the email addresses and the metadata fields
   * @returns An array of objects.
   */
  async extractEmailObjectsFromHeader() {
    const messagingFields = this.getMessagingFieldsOnly();
    const metaDataProps = this.getOtherMetaDataFields();
    const emailsObjects = await this.getEmailsObjectsFromHeader(
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
  async extractEmailObjectsFromBody() {
    if (Object.keys(this.body).length > 0) {
      await this.getEmailsObjectsFromBody();
    }
    return;
  }
}
module.exports = EmailMessage;
