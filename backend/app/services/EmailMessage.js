'use-strict';
const regExHelpers = require('../utils/regexpUtils');
const dataStructureHelpers = require('../utils/dataStructureHelpers');
const { emailsRaw } = require('../models');
const config = require('config'),
  NEWSLETTER_HEADER_FIELDS = config
    .get('email_types.newsletter')
    .split(','),
  TRANSACTIONAL_HEADER_FIELDS = config
    .get('email_types.transactional')
    .split(','),
  FIELDS = [ 'to', 'from', 'cc', 'bcc', 'reply-to' ];

class EmailMessage {
  /**
   * EmailMessage constructor
   * @param sequentialId - The sequential ID of the message.
   * @param header - The header of the message.
   * @param body - The body of the message.
   * @param user - The user.
   * @param dateCaseOfBody - The date.
   */
  constructor(sequentialId, header, body, user, dateCaseOfBody) {
    this.sequentialId = sequentialId;
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
        const reg = new RegExp(regExHeader, 'i');

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
        const reg = new RegExp(regExHeader, 'i');

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
      if (Date.parse(this.header.date[ 0 ])) {
        return this.header.date[ 0 ];
      }
      return '';
      
    } return '';
  }
  /**
   * getMessagingFieldsOnly returns an object with only the messaging fields from the header
   * @returns An object with only the messaging fields from the header.
   */
  getMessagingFieldsOnly() {
    const messagingProps = {};

    Object.keys(this.header).map((key) => {
      if (FIELDS.includes(key)) {
        messagingProps[ key ] = this.header[ key ][ 0 ];
      }
    });
    return messagingProps;
  }
  /**
   * getMessageId returns the message-id of the email
   * @returns The message-id of the email.
   */
  getMessageId() {
    if (this.header[ 'message-id' ]) {
      return this.header[ 'message-id' ][ 0 ].substring(0, 60);
    }
    return `message_id_unknown ${this.header.date}`;
    
  }

  /**
   * storeEmailAddressesExtractedFromHeader takes the header of an email, extracts the email addresses from it, and saves them to the
   * database
   * @param messagingFields - an object containing the email headers
   * @returns Nothing is being returned.
   */
  storeEmailAddressesExtractedFromHeader(messagingFields) {
    Object.keys(messagingFields).map((key) => {
      // extract Name and Email in case of a header
      const emails = regExHelpers.extractNameAndEmail(messagingFields[ key ]);

      if (emails.length > 0) {
        emails.map(async(email) => {
          if (email && email.address && this.user.email != email.address) {
            // domain is an array
            const domain = await dataStructureHelpers.CheckDomainStatus(
              email.address
            );

            if (!dataStructureHelpers.IsNoReply(email.address) && domain[ 0 ]) {
              return emailsRaw.create({
                'user_id': this.user.id,
                'from': key == 'from',
                'reply_to': key == 'reply-to',
                'to': key == 'to',
                'cc': key == 'cc',
                'bcc': key == 'bcc',
                'date': this.getDate(),
                'name': email?.name ?? '',
                'address': email.address.toLowerCase(),
                'newsletter': key == 'from' ? this.isNewsletter() : false,
                'transactional': key == 'from' ? this.isTransactional() : false,
                'domain_type': domain[ 1 ],
                'domain_name': domain[ 2 ],
                'conversation': this.isInConversation()
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
      this.body.toString('utf8')
    );

    delete this.body;
    if (emails.length > 0) {
      emails.map(async(email) => {
        if (this.user.email != email && email) {
          const domain = await dataStructureHelpers.CheckDomainStatus(email);

          if (!dataStructureHelpers.IsNoReply(email) && domain[ 0 ]) {
            return emailsRaw.create({
              'user_id': this.user.id,
              'from': false,
              'reply_to': false,
              'to': false,
              'cc': false,
              'bcc': false,
              'body': true,
              'date': this.date,
              'name': '',
              'address': email.toLowerCase(),
              'newsletter': false,
              'transactional': false,
              'domain_type': domain[ 1 ],
              'domain_name': domain[ 2 ],
              'conversation': this.isInConversation()
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
      const messagingFields = this.getMessagingFieldsOnly();

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
