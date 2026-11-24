/**
 * SMS segment analyzer.
 *
 * Decides whether an SMS uses GSM-7 or Unicode (UCS-2) encoding, measures every
 * character in that encoding, and fills the segments forward with whole
 * characters.
 *
 * Rules
 *  - One character outside the GSM-7 tables makes the whole message Unicode.
 *  - GSM-7: a single message holds 160 septets (7 bits each), each segment of
 *    a longer message holds 153. Unicode: a single message holds 70 code units
 *    (16 bits each), each segment of a longer message holds 67.
 *  - GSM-7 basic characters take 1 septet. The extension characters take 2
 *    (escape plus character).
 *  - Unicode characters take 1 code unit. A character above U+FFFF takes 2
 *    (surrogate pair).
 *  - A character that does not fit in the space left in a segment starts the
 *    next segment, so a segment can close one unit short (152 septets or 66
 *    code units).
 *
 * Scope
 *  - The default GSM-7 alphabet and its extension table only. National language
 *    shift tables (Turkish, Spanish, Portuguese and others) are not handled.
 *  - Counting follows the 3GPP rules listed under Sources. How a given operator
 *    or provider behaves is not covered.
 *  - Labelling of hidden characters is best effort. It relies on the Unicode
 *    data of the engine that runs the code, so the label of a recently assigned
 *    character can differ between engines. Counts never depend on it.
 *
 * JavaScript specifics, for anyone porting this to another language
 *  - A JavaScript string is a sequence of UTF-16 code units. string.length
 *    counts those units, not characters, so sizes are never taken from it. The
 *    text is walked by code point with [...sms], and every size is added up
 *    character by character.
 *  - A character above U+FFFF takes 2 code units in Unicode mode:
 *    codePointAt(0) > 0xFFFF. Where strings hold code points or UTF-8 bytes
 *    (Rust, Go), run the same test on the code point value. The byte length of
 *    the text is the wrong measure.
 *  - A JavaScript string can hold half of a surrogate pair. That is reported as
 *    an error here. Keep the check only where the language allows such a
 *    string.
 *  - The \p{...} character classes need the u flag. Class names and the Unicode
 *    version differ in other regex engines.
 *  - The function never throws. Bad input comes back as status.ok === false.
 *    Another language may prefer an exception or a Result type.
 *  - A browser textarea turns a typed or pasted CR LF line break into a single
 *    LF in its value, so the line break arrives as 1 character. Text passed in
 *    unchanged counts CR LF as 2.
 *
 * Tested on Node 22 (Unicode 17.0).
 *
 * Sources
 *  - 3GPP TS 23.038 defines the two alphabets and the 16-bit UCS2 coding of
 *    ISO/IEC 10646:
 *    https://www.etsi.org/deliver/etsi_ts/123000_123099/123038/18.00.00_60/ts_123038v180000p.pdf
 *  - 3GPP TS 23.040, clause 9.2.3.24.1, gives 153 and 67 per segment and
 *    forbids splitting an escape-sequence character or a UCS2 character:
 *    https://www.etsi.org/deliver/etsi_ts/123000_123099/123040/18.00.00_60/ts_123040v180000p.pdf
 *  - 3GPP names the encoding UCS-2, a 16-bit coding based on ISO/IEC 10646, and
 *    says nothing about characters above U+FFFF. The Unicode Standard defines
 *    UTF-16, in which such a character takes two 16-bit code units, a surrogate
 *    pair, and the counting here follows that (section 2.5.2):
 *    https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-2/
 *  - Providers document the same length of 2 (32 bits):
 *    https://developers.telnyx.com/docs/messaging/messages/message-encoding
 *    https://docs.customer.io/messaging/channels/sms/character-encoding/
 *    https://help.seven.io/en/sms/send-emojis
 *    https://www.twilio.com/en-us/blog/developers/rcs-character-count
 */

/** GSM-7 default alphabet: each character takes 1 septet (7 bits). */
const GSM_7_CHARS = new Set([
  ..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
  "@£$¥_!\"#¤%&'()*+,-./:;<=>?¡§¿èéùìòÇØøÅåÆæßÉÄÖÑÜäöñüàΔΦΓΛΩΠΨΣΘΞ \n\r"
]);

/**
 * GSM-7 extension table: each character takes 2 septets (14 bits), an escape
 * plus the character.
 */
const GSM_7_EXT_CHARS = new Set([..."€{}[]\\^~|\f"]);

/**
 * Capacity of a single message and of each segment of a longer message, in
 * septets or code units.
 */
const GSM_7_LIMITS = { single: 160, segment: 153 };
const UNICODE_LIMITS = { single: 70, segment: 67 };

/**
 * Characters that cannot be seen: control, format (zero-width and similar),
 * separators, private-use, unassigned and surrogate code points, the variation
 * selectors, and the blank look-alikes that are letters or symbols by category:
 * the Hangul fillers (U+115F, U+1160, U+3164, U+FFA0) and the Braille blank
 * (U+2800), and two invisible marks: the combining grapheme joiner (U+034F) and
 * the Khmer inherent vowels (U+17B4, U+17B5).
 *
 * This is a best-effort list, not every invisible character that exists.
 * The ordinary space is handled separately and stays visible.
 */
const NON_PRINTABLE_REGEX = /^[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Cs}\p{Z}\u034F\u115F\u1160\u17B4\u17B5\u2800\u3164\uFFA0\uFE00-\uFE0F\u{E0100}-\u{E01EF}]$/u;

const SUCCESS_MESSAGE = "Analyzed Successfully";

const isLoneSurrogate = (char) => {
  if (char.length !== 1) return false;
  const code = char.charCodeAt(0);
  return code >= 0xD800 && code <= 0xDFFF;
};

const describeSymbol = (char) => {
  if (char !== " " && NON_PRINTABLE_REGEX.test(char)) {
    return `Non-Printable: U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
  }
  return char;
};

const buildEmptyGroups = () => ({
  "1": { count: 0, consumption: 0, symbols: [] },
  "2": { count: 0, consumption: 0, symbols: [] },
});

const buildErrorResult = (response) => ({
  status: { ok: false, response },
  isUnicode: null,
  segments: null,
  segmentSizes: null,
  length: null,
  bySize: buildEmptyGroups(),
});

/**
 * Fills segments forward with whole characters. A character that does not fit
 * closes the current segment and starts the next one.
 * @param {number[]} sizes - Size of each character in septets or code units.
 * @param {{single: number, segment: number}} limits - Capacity of a single
 *   message and of a segment.
 * @returns {number[]} The size used in each segment, in order.
 */
const splitIntoSegments = (sizes, limits) => {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total <= limits.single) return [total];

  const segmentSizes = [];
  let used = 0;
  for (const size of sizes) {
    if (used + size > limits.segment) {
      segmentSizes.push(used);
      used = 0;
    }
    used += size;
  }
  segmentSizes.push(used);
  return segmentSizes;
};

/**
 * Analyzes an SMS body. Never throws: invalid input comes back as
 * status.ok === false.
 *
 * @param {string} sms - The SMS body.
 * @returns {{
 *   status: {ok: boolean, response: string},
 *   isUnicode: (boolean|null),
 *   segments: (number|null),
 *   segmentSizes: (number[]|null),
 *   length: (number|null),
 *   bySize: Object<string, {count: number, consumption: number,
 *     symbols: string[]}>
 * }}
 *   segments is the number of segments, segmentSizes the size used in each
 *   segment, length the total size in septets (GSM-7) or code units (Unicode).
 *   bySize groups the characters by the size one character takes, "1" or "2":
 *   count is the number of characters, consumption the capacity they use,
 *   symbols the characters in text order. A character that cannot be seen
 *   appears as "Non-Printable: U+XXXX". On an error every field except status
 *   is null and both groups are empty.
 */
function analyzeSms(sms) {
  if (typeof sms !== "string") return buildErrorResult("SMS content must be text");
  if (sms.length === 0) return buildErrorResult("SMS content is empty");

  const characters = [...sms];
  if (characters.some(isLoneSurrogate)) {
    return buildErrorResult("SMS content has a broken character (half of an emoji)");
  }

  // One character outside the GSM-7 tables moves the whole message to Unicode.
  const isUnicode = characters.some((char) => !GSM_7_CHARS.has(char) && !GSM_7_EXT_CHARS.has(char));

  const sizeOf = isUnicode
    ? (char) => (char.codePointAt(0) > 0xFFFF ? 2 : 1)
    : (char) => (GSM_7_EXT_CHARS.has(char) ? 2 : 1);

  const bySize = buildEmptyGroups();
  const sizes = [];
  for (const char of characters) {
    const size = sizeOf(char);
    sizes.push(size);
    const group = bySize[size];
    group.count += 1;
    group.consumption += size;
    group.symbols.push(describeSymbol(char));
  }

  const segmentSizes = splitIntoSegments(sizes, isUnicode ? UNICODE_LIMITS : GSM_7_LIMITS);

  return {
    status: { ok: true, response: SUCCESS_MESSAGE },
    isUnicode,
    segments: segmentSizes.length,
    segmentSizes,
    length: bySize["1"].consumption + bySize["2"].consumption,
    bySize,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { analyzeSms };
}
