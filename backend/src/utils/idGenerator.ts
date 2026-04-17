/* eslint-disable import/prefer-default-export */

import { customAlphabet } from 'nanoid/async';
import ENV from '../config';
import { FLICKR_BASE_58_CHARSET } from './constants';

export function flickrBase58IdGenerator(): () => Promise<string> {
  return customAlphabet(
    FLICKR_BASE_58_CHARSET,
    ENV.LEADMINER_MINING_ID_GENERATOR_LENGTH
  );
}
