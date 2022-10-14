'use-strict';
const regExHelpers = require('../utils/regexpHelpers');
const dateHelpers = require('../utils/dateHelpers');
const emailMessageHelpers = require('../utils/emailMessageHelpers');
const emailAddressHelpers = require('../utils/minedDataHelpers');
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
    // eslint-disable-next-line no-constant-condition
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
    // eslint-disable-next-line no-constant-condition
    if (true) {
      // TODO : OPTIONS as user query
      const emails = regExHelpers.extractNameAndEmailFromBody(
        this.body.toString('utf8')
      );
      delete this.body;
      // store extracted emails
      //this.storeEmailsAddressesExtractedFromBody(message, emails);
    }
  }

  /**
   * storeEmailsAddressesExtractedFromHeader takes the extracted email addresses, give tags, check for noreply,check domain and saves them to the
   * database
   * @param {object} messages - an object containing the saved message data row
   * @param {array} emails - an array of objects that contains the extracted email addresses and the names
   * @param {string} fieldName - the current extracting field name (eg: from , cc , to...)
   * @returns Nothing is being returned.
   */
  storeEmailsAddressesExtractedFromHeader(message, emails, fieldName) {
    const tags = [];
    if (fieldName == 'from') {
      // get if newsletter
      const newsletter = this.isNewsletter();
      if (newsletter) {
        tags.push(this.buildTag('newsletter', 'Newsletter', 2, 'refined'));
      }
      // get if transactional
      const transactional = this.isTransactional();
      if (transactional) {
        tags.push(
          this.buildTag('transactional', 'Transactional', 2, 'refined')
        );
      }
    }
    if (emails?.length > 0) {
      // loop through emails array
      emails.map(async (email) => {
        if (email && email.address && this.user.email !== email.address) {
          // get if it's a noreply email
          const noReply = emailMessageHelpers.isNoReply(email.address);
          // get the domain status //TODO: SAVE DOMAIN STATUS IN DB
          const domain = await emailMessageHelpers.checkDomainStatus(
            email.address
          );
          // find the email type
          const type = emailAddressHelpers.findEmailAddressType(
            email.address,
            [email?.name],
            domain[1]
          );
          if (type != '') {
            tags.push(this.buildTag(type.toLowerCase(), type, 1, 'refined'));
          }
          if (noReply) {
            tags.push(this.buildTag('no-reply', 'noReply', 0, 'refined'));
          }
          if (!domain[0]) {
            // this domain is invalid
            redisClientForNormalMode
              .sismember('invalidDomainEmails', email.address)
              .then((member) => {
                if (member === 0) {
                  redisClientForNormalMode.sadd(
                    'invalidDomainEmails',
                    email.address
                  );
                }
              });
          } else {
            // if domain ok then we store to DB
            this.storeEmails(
              message,
              email.address,
              email?.name,
              tags,
              fieldName
            );
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
    const tags = [];
    if (emails?.length > 0) {
      // loop through emails extracted from the current body
      emails.map(async (email) => {
        if (this.user.email !== email && email) {
          // get domain status from DomainStatus Helper
          const noReply = emailMessageHelpers.isNoReply(email);
          // get the domain status
          const domain = await emailMessageHelpers.checkDomainStatus(email);

          const type = emailAddressHelpers.findEmailAddressType(
            email,
            [email?.name] ?? '',
            domain[1]
          );
          if (type != '') {
            tags.push(this.buildTag(type.toLowerCase(), type, 1, 'refined'));
          }
          if (noReply) {
            tags.push(this.buildTag('no-reply', 'noReply', 0, 'refined'));
          }
          if (!domain[0]) {
            redisClientForNormalMode
              .sismember('invalidDomainEmails', email)
              .then((member) => {
                if (member == 0) {
                  redisClientForNormalMode.sadd('invalidDomainEmails', email);
                }
              });
          } else {
            this.storeEmails(message, email, '', tags, 'body');
          }
        }
      });
    } else {
      delete this.body;
    }
  }
  /**
   * buildTag takes in a name, label, reachable, and type, and returns an object with those properties
   * used to build a tag object type
   * @param {string} name - The name of the tag.
   * @param {string} label - The label of the tag.
   * @param {int} reachable - true if the tag is reachable from the current tag, false otherwise
   * @param {string} type - The type of the tag.
   * @returns An object with the following properties:
   *   name: name,
   *   label: label,
   *   reachable: reachable,
   *   type: type,
   */
  buildTag(name, label, reachable, type) {
    return {
      name: name,
      label: label,
      reachable: reachable,
      type: type
    };
  }

  /**
   * storeEmails store the email address, name, tags and field name in the database
   * @param message - the message object returned from the API
   * @param email - the email address of the person
   * @param name - The name of the person
   * @param tags - an array of tags to be added to the person
   * @param fieldName - the name of the field that the email was found in
   */
  storeEmails(message, email, name, tags, fieldName) {
    supabaseHandlers
      .upsertPersons(supabaseClient, name ?? '', email.toLowerCase())
      // we should wait for the response so we capture the id
      .then((person, error) => {
        if (error) {
          logger.debug(`error when inserting to persons table ${error}`);
        }
        if (person && person?.body?.[0]) {
          //if saved and no errors then we can store the person linked to this point of contact
          supabaseHandlers
            .upsertPointOfContact(
              supabaseClient,
              message.body?.[0]?.id,
              this.user.id,
              person.body?.[0].personid,
              fieldName
            )
            .then((pointOfContact, error) => {
              if (error) {
                logger.debug(
                  `error when inserting to pointOfContact table ${error}`
                );
              }
            });

          // add the person id to tags
          for (let i = 0; i < tags.length; i++) {
            tags[i].personid = person.body?.[0].personid;
          }
          supabaseHandlers
            .createTags(supabaseClient, tags)
            // eslint-disable-next-line no-unused-vars
            .then((data, error) => {
              // TODO : HANDLE DATA AND ERROR
            });
        }
      });
  }
}
module.exports = EmailMessage;
