import EmailTagging from './stratetgies/EmailTaggingStratetgy';
import { group, linkedin, newsLetter, transactional } from './tags';
import { Tag, TaggingStratetgy } from './types';

class Tagging {
  private readonly taggingStratetgy;

  constructor(taggingStratetgy: TaggingStratetgy) {
    this.taggingStratetgy = taggingStratetgy;
  }

  getTag(options: any) {
    return this.taggingStratetgy.extractTags(options);
  }
}

const tags: Tag[] = [
  // Tags are sorted, from tags that have spesific rules to tags have more of general rules.
  // Always keep transactional as the last rule to check
  linkedin,
  newsLetter,
  group,
  transactional
];
const taggingStratetgy = new EmailTagging(tags);
const messageTaggingRules = new Tagging(taggingStratetgy);

export default messageTaggingRules;
