'use-strict';
const regExHelpers = require('../utils/regexpHelpers');
const dateHelpers = require('../utils/dateHelpers');
const emailMessageHelpers = require('../utils/emailMessageHelpers');
const redisClientForNormalMode =
  require('../../redis').redisClientForNormalMode();
const config = require('config'),
  NEWSLETTER_HEADER_FIELDS = config.get('email_types.newsletter').split(','),
  TRANSACTIONAL_HEADER_FIELDS = config
    .get('email_types.transactional')
    .split(','),
  FIELDS = ['to', 'from', 'cc', 'bcc', 'reply-to'];

const supabaseUrl = config.get('server.supabase.url');
const supabaseToken = config.get('server.supabase.token');
const { createClient } = require('@supabase/supabase-js');
const supabaseClient = createClient(supabaseUrl, supabaseToken);
const supabaseHandlers = require('./supabaseServices/supabase');
const logger = require('../utils/logger');
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
        const reg = new RegExp(`${regExHeader}`, 'i');
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
        const reg = new RegExp(`${regExHeader}`, 'i');
        return reg.test(headerField);
      });
    });
  }
  /**
   * isInConversation returns 1 if the header object has a key called "references", otherwise return 0
   * @returns The function isInConversation() is returning a boolean value.
   */
  isInConversation() {
    if (Object.keys(this.header).includes('references')) {
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
    if (this.header['message-id']) {
      return this.header['message-id'][0].substring(0, 60);
    }
    return `message_id_unknown ${this.header.date}`;
  }

  /**
   * extractThenStoreEmailsAddresses extracts emails from the header and body of an email, then stores them in a database
   */
  async extractThenStoreEmailsAddresses() {
    const messagingFields = this.getMessagingFieldsFromHeader();
    const messageID = this.getMessageId(),
      date = this.getDate();
    const message = await supabaseHandlers.upsertMessage(
      supabaseClient,
      messageID,
      this.user.id,
      'imap',
      'test',
      date
    );
    // case when header should be scanned
    // eslint-disable-next-line
    if (true) {
      Object.keys(messagingFields).map(async (key) => {
        // extract Name and Email in case of a header
        const emails = regExHelpers.extractNameAndEmail(
          messagingFields[`${key}`]
        );

        this.storeEmailsAddressesExtractedFromHeader(message, emails, key);
      });
    }
    // case when body should be scanned
    // eslint-disable-next-line
    if (true) {
      // TODO : OPTIONS as user query
      const emails = regExHelpers.extractNameAndEmailFromBody(
        this.body.toString('utf8')
      );
      delete this.body;
      // store extracted emails
      this.storeEmailsAddressesExtractedFromBody(message, emails);
    }
  }

  /**
   * storeEmailsAddressesExtractedFromHeader takes the extracted email addresses, and saves them to the
   * database
   * @param {object} messages - an object containing the saved message data row
   * @param {array} emails - an array of objects that contains the extracted email addresses and the names
   * @param {string} fieldName - the current extracting field name (eg: from , cc , to...)
   * @returns Nothing is being returned.
   */
  storeEmailsAddressesExtractedFromHeader(message, emails, fieldName) {
    if (emails?.length > 0) {
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
            // this domain is invalid
            redisClientForNormalMode
              .sismember('invalidDomainEmails', email.address)
              .then((member) => {
                if (member == 0) {
                  redisClientForNormalMode.sadd(
                    'invalidDomainEmails',
                    email.address
                  );
                }
              });
          } else if (!noReply && domain[0]) {
            // if domain ok then we store to DB
            supabaseHandlers
              .upsertPointOfContact(
                supabaseClient,
                message.body[0]?.id,
                this.user.id,
                email?.name ?? '',
                fieldName
              )
              // we should wait for the response so we capture the id
              .then((pointOfContact, error) => {
                if (error) {
                  logger.debug(
                    `error when inserting to pointsOfContact table ${error}`
                  );
                }
                if (pointOfContact && pointOfContact.body[0]) {
                  //if saved and no errors then we can store the person linked to this point of contact
                  supabaseHandlers
                    .upsertPersons(
                      supabaseClient,
                      email?.name ?? '',
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
  }
  /**
   * storeEmailsAddressesExtractedFromBody takes the extracted email addresses from the body, and saves them to the
   * database
   * @param {object} messages - an object containing the saved message data row
   * @param {array} emails - an array of objects that contains the extracted email addresses
   * @returns Nothing is being returned.
   */
  storeEmailsAddressesExtractedFromBody(message, emails) {
    if (emails?.length > 0) {
      // loop through emails extracted from the current body
      emails.map(async (email) => {
        if (this.user.email != email && email) {
          // get domain status from DomainStatus Helper
          const noReply = emailMessageHelpers.isNoReply(email);
          // get the domain status
          const domain = await emailMessageHelpers.checkDomainStatus(email);
          if (!domain[0]) {
            redisClientForNormalMode
              .sismember('invalidDomainEmails', email)
              .then((member) => {
                if (member == 0) {
                  redisClientForNormalMode.sadd('invalidDomainEmails', email);
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
                '',
                'body'
              )
              .then((pointOfContact, pointOfContactUpsertError) => {
                if (pointOfContactUpsertError) {
                  logger.debug(
                    `error when inserting to pointsOfContact table ${pointOfContactUpsertError}`
                  );
                }
                if (pointOfContact && pointOfContact.body[0]) {
                  supabaseHandlers
                    .upsertPersons(
                      supabaseClient,
                      '',
                      email.toLowerCase(),
                      pointOfContact.body[0]?.id
                    )
                    .then((data, personUpsertError) => {
                      if (personUpsertError) {
                        logger.debug(
                          `error when inserting to perssons table ${personUpsertError}`
                        );
                      }
                    });
                }
              });
          }
        }
      });
    } else {
      delete this.body;
    }
  }
}
module.exports = EmailMessage;
