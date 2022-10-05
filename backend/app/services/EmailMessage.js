"use-strict";
const regExHelpers = require("../utils/regexpHelpers");
const dateHelpers = require("../utils/dateHelpers");
const emailMessageHelpers = require("../utils/emailMessageHelpers");
const { emailsRaw } = require("../models");
const redisClientForNormalMode =
  require("../../redis").redisClientForNormalMode();
const config = require("config"),
  NEWSLETTER_HEADER_FIELDS = config.get("email_types.newsletter").split(","),
  TRANSACTIONAL_HEADER_FIELDS = config
    .get("email_types.transactional")
    .split(","),
  FIELDS = ["to", "from", "cc", "bcc", "reply-to"];

const supabaseUrl = config.get("server.supabase.url");
const supabaseToken = config.get("server.supabase.token");
const { createClient } = require("@supabase/supabase-js");
const supabaseClient = createClient(supabaseUrl, supabaseToken);
const supabaseHandlers = require("./supabaseServices/supabase");
const logger = require("../utils/logger");
class EmailMessage {
  /**
   * EmailMessage constructor
   * @param sequentialId - The sequential ID of the message.
   * @param header - The header of the message.
   * @param body - The body of the message.
   * @param user - The user.

   */
  constructor(sequentialId, header, body, user) {
    this.sequentialId = sequentialId;
    this.header = header || {};
    this.body = body || {};
    this.user = user;
  }
  /**
   * If the header contains any of the fields in the NEWSLETTER_HEADER_FIELDS array, then return true
   * @returns True or False
   */
  isNewsletter() {
    return Object.keys(this.header).some((headerField) => {
      return NEWSLETTER_HEADER_FIELDS.some((regExHeader) => {
        const reg = new RegExp(`${regExHeader}`, "i");
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
        const reg = new RegExp(`${regExHeader}`, "i");
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
    }
    return 0;
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
        return dateHelpers.parseDate(this.header.date[0]);
      }
      return this.header.date;
    }
    return this.header.date;
  }
  /**
   * getMessagingFieldsFromHeader returns an object with only the messaging fields from the header
   * @returns An object with only the messaging fields from the header.
   */
  getMessagingFieldsFromHeader() {
    const messagingProps = {};
    Object.keys(this.header).map((key) => {
      if (FIELDS.includes(key)) {
        messagingProps[`${key}`] = this.header[`${key}`][0];
      }
    });
    return messagingProps;
  }
  /**
   * getMessageId returns the message-id of the email
   * @returns The message-id of the email.
   */
  getMessageId() {
    if (this.header["message-id"]) {
      return this.header["message-id"][0].substring(0, 60);
    }
    return `message_id_unknown ${this.header.date}`;
  }

  /**
   * storeEmailAddressesExtractedFromHeader takes the header of an email, extracts the email addresses from it, and saves them to the
   * database
   * @param messagingFields - an object containing the email headers
   * @returns Nothing is being returned.
   */
  async storeEmailAddressesExtractedFromHeader(messagingFields) {
    const messageID = this.getMessageId(),
      date = this.getDate();
    let message = await supabaseHandlers.upsertMessage(
      supabaseClient,
      messageID,
      this.user.id,
      "imap header",
      "test",
      date
    );
    Object.keys(messagingFields).map(async (key) => {
      // extract Name and Email in case of a header
      const emails = regExHelpers.extractNameAndEmail(
        messagingFields[`${key}`]
      );
      if (emails.length > 0) {
        //let datatat = data[0].messageid;
        emails.map(async (email) => {
          if (email && email.address && this.user.email != email.address) {
            // get if it's a noreply email
            const noReply = emailMessageHelpers.isNoReply(email.address);
            // get the domain status
            const domain = await emailMessageHelpers.checkDomainStatus(
              email.address
            );
            if (!domain[0]) {
              redisClientForNormalMode
                .sismember("invalidDomainEmails", email.address)
                .then((member) => {
                  if (member == 0) {
                    redisClientForNormalMode.sadd(
                      "invalidDomainEmails",
                      email.address
                    );
                  }
                });
            } else if (!noReply && domain[0]) {
              if (message.body == null) {
                console.log(message);
              }
              supabaseHandlers
                .upsertPointOfContact(
                  supabaseClient,
                  message.body[0]?.id,
                  this.user.id,
                  email?.name ?? "",
                  key
                )
                .then((pointOfContact, error) => {
                  if (error) {
                    logger.debug(
                      `error when inserting to pointsOfContact table ${error}`
                    );
                  }
                  if (pointOfContact && pointOfContact.body[0]) {
                    supabaseHandlers
                      .upsertPersons(
                        supabaseClient,
                        email?.name ?? "",
                        email.address.toLowerCase(),
                        pointOfContact.body[0]?.id
                      )
                      .then((data, error) => {
                        if (error) {
                          logger.debug(
                            `error when inserting to perssons table ${error}`
                          );
                        }
                      });
                  }
                });
            }
          }
        });
        emails.length = 0;
      } else {
        delete this.header;
      }
    });
  }

  /**
   * storeEmailAddressesExtractedFromBody takes the body of an email, extracts all the email addresses from it, and saves them to the
   * database
   * @returns Nothing
   */
  storeEmailAddressesExtractedFromBody() {
    const emails = regExHelpers.extractNameAndEmailFromBody(
      this.body.toString("utf8")
    );
    delete this.body;
    if (emails.length > 0) {
      // loop through emails extracted from the current body
      emails.map(async (email) => {
        if (this.user.email != email && email) {
          // get domain status from DomainStatus Helper
          const domain = await emailMessageHelpers.checkDomainStatus(email);
          // check if it's not noReply, and the doamin is valid , if Ok Store it to the database
          if (!emailMessageHelpers.isNoReply(email) && domain[0]) {
            return emailsRaw.create({
              user_id: this.user.id,
              from: false,
              reply_to: false,
              to: false,
              cc: false,
              bcc: false,
              body: true,
              date: this.getDate(),
              name: "",
              address: email.toLowerCase(),
              newsletter: false,
              transactional: false,
              domain_type: domain[1],
              domain_name: domain[2],
              conversation: this.isInConversation(),
            });
          }
        }
      });
    } else {
      delete this.body;
    }
  }
  /**
   * extractEmailAddressesFromHeader calls functions to extract and store addresses.
   * @returns the email addresses extracted from the header.
   */
  extractEmailAddressesFromHeader() {
    if (this.header) {
      // used to reduce looping through useless fields
      const messagingFields = this.getMessagingFieldsFromHeader();
      this.storeEmailAddressesExtractedFromHeader(messagingFields);
    }
  }
  /**
   * extractEmailAddressesFromBody calls functions to extract and store addresses.
   * @returns the email addresses extracted from the header.
   */
  extractEmailAddressesFromBody() {
    if (this.body) {
      this.storeEmailAddressesExtractedFromBody();
      return;
    }
    delete this.body;
  }
}
module.exports = EmailMessage;
