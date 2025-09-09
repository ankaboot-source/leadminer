/**
 * ============================================================
 * Supabase License and Attribution
 * ============================================================
 *
 * Portions of this code are adapted from the Supabase project:
 *   Repository: https://github.com/supabase
 *   Copyright (c) 2022-2023 Supabase, Inc.
 *
 * Licensed under the MIT License: https://opensource.org/licenses/MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation, the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * - The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * ============================================================
 * Custom Implementation: Supabase Cookie Optimization
 * ============================================================
 *
 * This implementation optimizes the Supabase session cookie size by:
 *   - reducing `user.user_metadata` object.
 *   - Adopting chunking and encoding logic from the original
 *     Supabase SSR utilities for efficient cookie handling.
 *
 * References:
 *   - Design Overview: https://github.com/supabase/ssr/blob/main/docs/design.md
 *   - Chunking Logic: https://github.com/supabase/ssr/blob/main/src/utils/chunker.ts
 *   - Encoding Logic: https://github.com/supabase/ssr/blob/main/src/utils/base64url.ts
 *
 * Key Note:
 *   - On page reload `useSupabaseUser`, `useSupabaseSession` will take their values
 *     from the cookies, so keep in mind that `user.user_metadata` object is not
 *     complete. Use `supabase.getUser` for complete details instead.
 */

import type { CookieOptions } from '#app';
import type { Session } from '@supabase/supabase-js';

interface Chunk {
  name: string;
  value: string;
}

const MAX_CHUNK_SIZE = 3180;
const TO_BASE64URL =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split('');

/**
 * Converts a Unicode codepoint to a multi-byte UTF-8 sequence.
 *
 * @param codepoint The Unicode codepoint.
 * @param emit      Function which will be called for each UTF-8 byte that represents the codepoint.
 */
function codepointToUTF8(codepoint: number, emit: (byte: number) => void) {
  if (codepoint <= 0x7f) {
    emit(codepoint);
    return;
  } else if (codepoint <= 0x7ff) {
    emit(0xc0 | (codepoint >> 6));
    emit(0x80 | (codepoint & 0x3f));
    return;
  } else if (codepoint <= 0xffff) {
    emit(0xe0 | (codepoint >> 12));
    emit(0x80 | ((codepoint >> 6) & 0x3f));
    emit(0x80 | (codepoint & 0x3f));
    return;
  } else if (codepoint <= 0x10ffff) {
    emit(0xf0 | (codepoint >> 18));
    emit(0x80 | ((codepoint >> 12) & 0x3f));
    emit(0x80 | ((codepoint >> 6) & 0x3f));
    emit(0x80 | (codepoint & 0x3f));
    return;
  }

  throw new Error(`Unrecognized Unicode codepoint: ${codepoint.toString(16)}`);
}

/**
 * Converts a JavaScript string to a sequence of UTF-8 bytes.
 *
 * @param str  The string to convert to UTF-8.
 * @param emit Function which will be called for each UTF-8 byte of the string.
 */
function stringToUTF8(str: string, emit: (byte: number) => void) {
  for (let i = 0; i < str.length; i += 1) {
    let codepoint = str.charCodeAt(i);

    if (codepoint > 0xd7ff && codepoint <= 0xdbff) {
      // most UTF-16 codepoints are Unicode codepoints, except values in this
      // range where the next UTF-16 codepoint needs to be combined with the
      // current one to get the Unicode codepoint
      const highSurrogate = ((codepoint - 0xd800) * 0x400) & 0xffff;
      const lowSurrogate = (str.charCodeAt(i + 1) - 0xdc00) & 0xffff;
      codepoint = (lowSurrogate | highSurrogate) + 0x10000;
      i += 1;
    }

    codepointToUTF8(codepoint, emit);
  }
}

/**
 * Converts a JavaScript string (which may include any valid character) into a
 * Base64-URL encoded string. The string is first encoded in UTF-8 which is
 * then encoded as Base64-URL.
 *
 * @param str The string to convert.
 */
function stringToBase64URL(str: string) {
  const base64: string[] = [];

  let queue = 0;
  let queuedBits = 0;

  const emitter = (byte: number) => {
    queue = (queue << 8) | byte;
    queuedBits += 8;

    while (queuedBits >= 6) {
      const pos = (queue >> (queuedBits - 6)) & 63;
      base64.push(TO_BASE64URL[pos]);
      queuedBits -= 6;
    }
  };

  stringToUTF8(str, emitter); // Now this will work

  if (queuedBits > 0) {
    queue = queue << (6 - queuedBits);
    queuedBits = 6;

    while (queuedBits >= 6) {
      const pos = (queue >> (queuedBits - 6)) & 63;
      base64.push(TO_BASE64URL[pos]);
      queuedBits -= 6;
    }
  }

  return base64.join('');
}

/**
 * create chunks from a string and return an array of object
 */
function createChunks(key: string, value: string, chunkSize?: number): Chunk[] {
  const resolvedChunkSize = chunkSize ?? MAX_CHUNK_SIZE;

  let encodedValue = encodeURIComponent(value);

  if (encodedValue.length <= resolvedChunkSize) {
    return [{ name: key, value }];
  }

  const chunks: string[] = [];

  while (encodedValue.length > 0) {
    let encodedChunkHead = encodedValue.slice(0, resolvedChunkSize);

    const lastEscapePos = encodedChunkHead.lastIndexOf('%');

    // Check if the last escaped character is truncated.
    if (lastEscapePos > resolvedChunkSize - 3) {
      // If so, reslice the string to exclude the whole escape sequence.
      // We only reduce the size of the string as the chunk must
      // be smaller than the chunk size.
      encodedChunkHead = encodedChunkHead.slice(0, lastEscapePos);
    }

    let valueHead = '';

    // Check if the chunk was split along a valid unicode boundary.
    while (encodedChunkHead.length > 0) {
      try {
        // Try to decode the chunk back and see if it is valid.
        // Stop when the chunk is valid.
        valueHead = decodeURIComponent(encodedChunkHead);
        break;
      } catch (error) {
        if (
          error instanceof URIError &&
          encodedChunkHead.at(-3) === '%' &&
          encodedChunkHead.length > 3
        ) {
          encodedChunkHead = encodedChunkHead.slice(
            0,
            encodedChunkHead.length - 3,
          );
        } else {
          throw error;
        }
      }
    }

    chunks.push(valueHead);
    encodedValue = encodedValue.slice(encodedChunkHead.length);
  }

  return chunks.map((val, i) => ({ name: `${key}.${i}`, value: val }));
}

function createSupabaseCookies(
  key: string,
  value: string,
  cookieOptions: CookieOptions,
) {
  const setCookieOptions = {
    maxAge: cookieOptions.maxAge,
    path: '/',
    sameSite: cookieOptions.sameSite as 'lax' | 'strict' | 'none' | undefined,
    secure: cookieOptions.secure,
  };

  const encoded = `base64-${stringToBase64URL(value)}`;
  const setCookies = createChunks(key, encoded).map(({ name, value: val }) => ({
    name,
    value: val,
    options: setCookieOptions,
  }));

  return setCookies;
}

function deleteSupabaseCookies(keys: string[], excluded: string[] = []) {
  // Generate chunk names for all keys
  const chunkNames = keys.flatMap((key) => [
    key,
    ...Array.from({ length: 5 }).map((_, i) => `${key}.${i}`),
  ]);

  // Filter out excluded cookies from the chunkNames list
  const cookiesToDelete = chunkNames.filter((name) => !excluded.includes(name));

  // Iterate through all cookies and delete the relevant ones
  const cookies = document.cookie.split('; ');
  cookies.forEach((cookie) => {
    const cookieName = cookie.split('=')[0];
    if (cookiesToDelete.includes(cookieName)) {
      useCookie(cookieName).value = null;
    }
  });
}

export default defineNuxtPlugin(() => {
  const supabase = useSupabaseClient();
  const newSession = ref<Session | null>(null);
  const { url, cookieName, cookieOptions } = useRuntimeConfig().public.supabase;

  const overwriteSupabaseCookies = (session: Session) => {
    try {
      const trimmedSession: Session = {
        ...session,
        user: {
          ...session.user,
          user_metadata: {
            ...session.user.user_metadata,
            EmailTemplate: {
              language: session.user.user_metadata.EmailTemplate?.language,
            },
          },
        },
      };

      // Delete user identities
      delete trimmedSession.user.identities;

      const maxAge = 60 * 60 * 24 * 30; // 30 days

      const storageName = `${cookieName}-${new URL(url).hostname.split('.')[0]}-auth-token`;

      const cookies = createSupabaseCookies(
        storageName,
        JSON.stringify(trimmedSession),
        cookieOptions,
      );

      if (cookies.length > 0) {
        deleteSupabaseCookies(
          [storageName],
          cookies.map(({ name }) => name),
        );
        cookies.forEach(({ name, value: val }) => {
          const cookie = useCookie(name, {
            maxAge,
            path: '/',
            sameSite: cookieOptions.sameSite as
              | 'lax'
              | 'strict'
              | 'none'
              | undefined,
            secure: cookieOptions.secure,
          });
          cookie.value = val;
        });
      }
    } catch (error) {
      console.error('Error overwriting Supabase cookies:', error);
    }
  };

  if (import.meta.client) {
    watch(newSession, (session) => {
      if (session) overwriteSupabaseCookies(session);
    });
  }

  supabase.auth.onAuthStateChange((event, session) => {
    console.log(
      'Auth event:',
      event,
      session,
      `expires at ${
        session?.expires_at !== undefined
          ? new Date(session.expires_at * 1000)
          : 'unknown'
      }`,
    );

    if (session) {
      newSession.value = session;
    }
  });
});
