"use-strict";
const regExHelpers = require("../utils/regexpUtils");
const dataStructureHelpers = require("../utils/dataStructureHelpers");
const { emailsRaw } = require("../models");
const config = require("config");
const NEWSLETTER_HEADER_FIELDS = config
  .get("email_types.newsletter")
  .split(",");
const TRANSACTIONAL_HEADER_FIELDS = config
  .get("email_types.transactional")
  .split(",");
const FIELDS = ["to", "from", "cc", "bcc", "reply-to"];

class EmailMessage {
  /**
   * EmailMessage constructor
   * @param sequentialId - The sequential ID of the message.
   * @param size - The size of the message in bytes.
   * @param header - The header of the message.
   * @param body - The body of the message.
   * @param user - The user.
   * @param dateCaseOfBody - The date.
   */
  constructor(sequentialId, size, header, body, user, dateCaseOfBody) {
    this.sequentialId = sequentialId;
    this.size = size;
    this.header = header || {};
    this.body = body || {};
    this.user = user;
    this.date = dateCaseOfBody;
  }

  /**
   * If the header contains any of the fields in the NEWSLETTER_HEADER_FIELDS array, then return true
   * @returns True or False
   */
  isNewsletter() {
    return Object.keys(this.header).some((headerField) => {
      return NEWSLETTER_HEADER_FIELDS.some((regExHeader) => {
        const reg = new RegExp(regExHeader, "i");
        return reg.test(headerField);
      });
    });
  }
  /**
   * isTransactional returns true if the email is transactional, and false if it's not
   * @returns A boolean value.
   */
  isTransactional() {
    return Object.keys(this.header).some((headerField) => {
      return TRANSACTIONAL_HEADER_FIELDS.some((regExHeader) => {
        const reg = new RegExp(regExHeader, "i");
        return reg.test(headerField);
      });
    });
  }
  /**
   * isInConversation returns 1 if the header object has a key called "references", otherwise return 0
   * @returns The function isInConversation() is returning a boolean value.
   */
  isInConversation() {
    if (Object.keys(this.header).includes("references")) {
      return 1;
    } else {
      return 0;
    }
  }
  /**
   * getDate returns the value of the "date" property of the
   * header
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
   * getMessagingFieldsOnly returns an object with only the messaging fields from the header
   * @returns An object with only the messaging fields from the header.
   */
  getMessagingFieldsOnly() {
    const messagingProps = {};
    Object.keys(this.header).map((key) => {
      if (FIELDS.includes(key)) {
        messagingProps[key] = this.header[key][0];
      }
    });
    return messagingProps;
  }
  /**
   * getOtherMetaDataFields takes the header object and returns an object with all the properties that are not in the FIELDS
   * array
   * @returns An object with all the metadata fields that are not in the FIELDS array.
   */
  getOtherMetaDataFields() {
    const metaDataProps = {};
    Object.keys(this.header).map((key) => {
      if (!FIELDS.includes(key)) {
        metaDataProps[key] = this.header[key][0];
      }
    });
    return metaDataProps;
  }
  /**
   * getMessageId returns the message-id of the email
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
   * getEmailsObjectsFromHeader takes the header of an email, extracts the email addresses from it, and saves them to the
   * database
   * @param messagingFields - an object containing the email headers
   * @returns Nothing is being returned.
   */
  getEmailsObjectsFromHeader(messagingFields) {
    Object.keys(messagingFields).map((key) => {
      //extract Name and Email in case of a header
      const emails = regExHelpers.extractNameAndEmail(messagingFields[key]);
      if (emails.length > 0) {
        emails.map((email) => {
          if (
            email &&
            email.address &&
            this.user.email != email.address &&
            !dataStructureHelpers.IsNoReply(email.address) &&
            dataStructureHelpers.checkDomainIsOk(email.address)
          ) {
            return emailsRaw.create({
              user_id: this.user.id,
              from: key == "from" ? true : false,
              reply_to: key == "reply-to" ? true : false,
              to: key == "to" ? true : false,
              cc: key == "cc" ? true : false,
              bcc: key == "bcc" ? true : false,
              date: this.getDate(),
              name: email?.name ?? "",
              address: email.address.toLowerCase(),
              newsletter: key == "from" ? this.isNewsletter() : false,
              transactional: key == "from" ? this.isTransactional() : false,
              conversation: this.isInConversation(),
            });
          }
        });
      } else {
        return;
      }
    });
  }

  /**
   * getEmailsObjectsFromBody takes the body of an email, extracts all the email addresses from it, and saves them to the
   * database
   * @returns Nothing
   */
  getEmailsObjectsFromBody() {
    const emails = regExHelpers.extractNameAndEmailFromBody(
      this.body.toString("utf8")
    );

    if (emails.length > 0) {
      emails.map((email) => {
        if (
          email &&
          this.user.email != email &&
          !dataStructureHelpers.IsNoReply(email) &&
          dataStructureHelpers.checkDomainIsOk(email)
        ) {
          return emailsRaw.create({
            user_id: this.user.id,
            from: false,
            reply_to: false,
            to: false,
            cc: false,
            bcc: false,
            body: true,
            date: this.date,
            name: "",
            address: email.toLowerCase(),
            newsletter: false,
            transactional: false,
            conversation: this.isInConversation(),
          });
        }
      });
    } else {
      return;
    }
  }
  /**
   * extractEmailObjectsFromHeader takes the header, extracts the messaging fields, extracts the other metadata fields, and then
   * returns an array of objects that contain the email addresses and the metadata fields
   * @returns An array of objects.
   */
  async extractEmailObjectsFromHeader() {
    const messagingFields = this.getMessagingFieldsOnly();
    const metaDataProps = this.getOtherMetaDataFields();
    const emailsObjects = this.getEmailsObjectsFromHeader(
      messagingFields,
      metaDataProps
    );
    return emailsObjects;
  }
  /**
   * extractEmailObjectsFromBody takes the body of the email, converts it to a string, and then uses a regular expression to
   * extract all the email addresses from the body
   * @returns An array of objects.
   */
  async extractEmailObjectsFromBody() {
    if (this.body) {
      this.getEmailsObjectsFromBody();
    }
  }
}
module.exports = EmailMessage;
