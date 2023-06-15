import { IdentifyGroupTagRules } from './rules/isGroup';
import { IdentifyLinkedinTagRules } from './rules/isLinkedin';
import { IdentifyNewsLetterRule } from './rules/isNewsLetter';
import { IdentifyTransactionalTagRules } from './rules/isTransactional';
import { Tag } from './types';

export const newsLetter: Tag = {
  name: 'newsletter',
  reachable: 1,
  rules: [new IdentifyNewsLetterRule()]
};
export const linkedin: Tag = {
  name: 'linkedin',
  reachable: 2,
  rules: [new IdentifyLinkedinTagRules()]
};
export const transactional: Tag = {
  name: 'transactional',
  reachable: 2,
  rules: [new IdentifyTransactionalTagRules()]
};
export const group: Tag = {
  name: 'group',
  reachable: 2,
  rules: [new IdentifyGroupTagRules()]
};
