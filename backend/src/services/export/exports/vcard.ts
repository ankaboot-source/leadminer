import VCard from 'vcard-creator';
import { Contact } from '../../../db/types';
import { ExportStrategy, ExportType, ExportResult } from '../types';

export default class VCardExport implements ExportStrategy<Contact> {
  readonly contentType = 'text/vcard';

  readonly type = ExportType.VCARD;

  async export(contacts: Contact[]): Promise<ExportResult> {
    const content = contacts
      .map((contact) => VCardExport.contactToVCard(contact))
      .join('\n');

    return {
      content,
      contentType: this.contentType,
      charset: 'utf-8',
      extension: 'vcf'
    };
  }

  private static contactToVCard(contact: Contact): string {
    const vcard = new VCard();

    vcard.addCategories(['leadminer']);

    if (contact.given_name?.length || contact.family_name?.length) {
      vcard.addName(contact.family_name ?? '', contact.given_name ?? '');
    } else if (contact.name) {
      vcard.addName(contact.name);
    }

    if (contact.email) {
      vcard.addEmail(contact.email);
    }

    contact.telephone?.forEach((phone) => {
      vcard.addPhoneNumber(phone);
    });

    if (contact.works_for) {
      vcard.addCompany(contact.works_for);
    }

    if (contact.job_title) {
      vcard.addJobtitle(contact.job_title);
    }

    // Address / location
    if (contact.location) {
      vcard.addAddress(contact.location);
    }

    if (contact.alternate_name)
      vcard.addNickname(contact.alternate_name.join(','));

    contact.same_as?.forEach((url) => {
      vcard.addURL(url);
    });

    if (contact.image) {
      vcard.addPhotoURL(contact.image);
    }

    return vcard.toString();
  }
}
