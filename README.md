# Beyond Character Counting: How SMS Segments Work

SMS messages are transmitted in segments, or parts, each with a limited content capacity. If the content fits within one segment, the message is considered a single-segment SMS. If it exceeds that capacity, it is divided into multiple segments. This process is transparent to the user, whose phone reassembles the segments and shows one complete message rather than its individual segments.

A single-segment SMS holds 1120 bits (140 bytes), a protocol-defined limit. How many characters fit depends on how many bits each character takes, which in turn depends on the encoding scheme. A multi-segment SMS also needs a header in every segment. The header takes some of those bits and reduces the space left for message content.

Standard text SMS is encoded in either GSM-7 or UCS-2. Messages containing English letters, numbers and standard symbols are usually sent using GSM-7. Messages containing emojis or characters from languages such as Bangla, Japanese, Arabic and Chinese are sent using Unicode (UCS-2). A UCS-2 message may still contain GSM-7 characters, but must contain at least one character that GSM-7 cannot encode.

## GSM-7 encoding

GSM-7 is the encoding normally used for English text messages. Most characters take 7 bits (technically a septet), although a small number take twice that. A character's length is the number of positions it takes within an SMS segment, and every length below is followed by its bits in brackets.

According to the GSM-7 table, the following characters have a length of 1 (7 bits). Together with the escape control code (`ESC`) `0x1B`, which is not listed below, these characters form the GSM-7 basic character set of 128 values.

- Letters and digits: `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`
- Space (SP): `0x20`
- Line feed (LF): `0x0A`
- Carriage return (CR): `0x0D`
- Punctuation, symbols and accented letters: `@£$¥_!"#¤%&'()*+,-./:;<=>?¡§¿èéùìòÇØøÅåÆæßÉÄÖÑÜäöñüàΔΦΓΛΩΠΨΣΘΞ`

The following characters have a length of 2 (14 bits), because each is sent as an escape code (`ESC`) followed by the character itself: 7 bits x 2 = 14 bits. These characters form the GSM-7 extended character set. There are 10 such characters.

- Printable characters: `€{}[]\^~|`
- Form feed (FF): `0x1B 0x0A`

A single-segment SMS made only of basic characters holds a maximum of 1120 bits / 7 bits = 160 characters. If the content contains one extended character, the maximum becomes 1 + (1120 bits - 14 bits) / 7 bits = 159 characters: the extended character counts as 1, and the remaining 1106 bits hold 158 basic characters.

## UCS-2 encoding

A single character outside the GSM-7 tables, for example an emoji, ç, á or a curly quote, switches the whole message to UCS-2: every character, including plain letters, then takes 16 bits.

In this encoding, each character has a length of 1 (16 bits, technically a code unit). Every Unicode character has a number, called its code point and written as `U+` followed by hex digits, for example `U+0995`. Characters from `U+0000` to `U+FFFF` form the BMP (Basic Multilingual Plane) and have a length of 1 (16 bits). That range covers Bangla and other everyday scripts, the GSM-7 characters, and some emojis.

Characters above `U+FFFF`, including most emojis, do not fit in 16 bits. Those are sent as surrogate pairs and have a length of 2 (32 bits).

A single-segment SMS holds a maximum of 1120 bits / 16 bits = 70 BMP characters. If the content contains one surrogate pair, the maximum becomes 1 + (1120 bits - 32 bits) / 16 bits = 69 characters: the pair counts as 1, and the remaining 1088 bits hold 68 BMP characters.

## Splitting long messages into segments

When the content exceeds 1120 bits, the SMS becomes multi-segment and a header is added to every segment. This header, called UDH (User Data Header), takes 48 bits and lets the receiving phone put the segments back in the right order.

For GSM-7, one alignment bit is added, because GSM-7 packs 7-bit values into octets. That gives 49 bits in total. A segment can then contain (1120 bits - 49 bits) / 7 bits = 153 basic characters. If the content contains one extended character, the maximum becomes 1 + (1120 bits - 49 bits - 14 bits) / 7 bits = 152 characters.

For UCS-2, no alignment bit is needed, so the header stays at 48 bits. A segment can contain (1120 bits - 48 bits) / 16 bits = 67 BMP characters. If the content contains one surrogate pair, the maximum becomes 1 + (1120 bits - 48 bits - 32 bits) / 16 bits = 66 characters.

Segments are filled with whole characters. A character is never cut between two segments: if the next character does not fit in the remaining space, it starts the next segment, so a segment can close before its capacity is fully used.

## Example: splitting a GSM-7 message

Consider a GSM-7 SMS that exceeds the single-segment limit of 1120 bits.

The SMS contains 152 basic characters, then one € (a GSM-7 extended character), then 152 more basic characters. That is 305 characters, but a total length of 306 (2142 bits), because € has a length of 2 (14 bits).

| Content | Characters | Length | Bits |
|---|---:|---:|---:|
| Basic characters | 304 | 304 | 2128 |
| Extended character € | 1 | 2 | 14 |
| **Total** | **305** | **306** | **2142** |

After deducting the 49-bit header, a segment has 1120 bits - 49 bits = 1071 bits available for content.

- Segment 1 takes the first 152 basic characters: 152 x 7 bits = 1064 bits. Only 7 bits remain.
- The € needs 14 bits. It does not fit in the remaining 7 bits, so it moves to segment 2.
- Segment 2 takes the € (14 bits) and 151 basic characters (1057 bits): 1071 bits, exactly full. That is 152 characters with a length of 153.
- Segment 3 takes the last character: 7 bits.

Result: 3 segments, with lengths 152 (1064 bits), 153 (1071 bits) and 1 (7 bits). Dividing the total length 306 (2142 bits) by the segment capacity of 153 (1071 bits) gives exactly 2, which is why plain division undercounts. The 7 bits left at the end of segment 1 cannot hold the €, so the last character spills into a third segment.

## Bit usage at a glance

| Parameter | GSM-7 | UCS-2 |
|---|---:|---:|
| Header, single segment (bits) | 0 | 0 |
| Header, multi-segment (bits) | 49 | 48 |
| GSM-7 basic character (bits) | 7 | 16 |
| GSM-7 extended character (bits) | 14 | 16 |
| Unicode (non GSM-7) character (bits) | N/A | 16 |
| Surrogate pair (bits) | N/A | 32 |
| Characters in a single-segment SMS | 160 | 70 |
| Characters per segment in a multi-segment SMS | 153 | 67 |

The character counts assume characters of the smallest size: basic GSM-7 characters, or Unicode characters from the BMP. Extended GSM-7 characters and surrogate pairs have a length of 2 each (14 bits for extended GSM-7 characters, 32 bits for surrogate pairs), so fewer characters fit.

## Scope and limits

- Covered: the default GSM-7 alphabet and the GSM-7 extension table, and UCS-2 with surrogate pairs.
- Not covered: national language shift tables (Turkish, Spanish, Portuguese and others). Text that needs such tables is counted here as Unicode.
- Not covered: operator and provider behaviour. Counting follows 3GPP TS 23.038 and 23.040, and a given network may differ.
- Not covered: other header sizes. The header here is 6 bytes (48 bits), which gives 153 and 67 per segment. Some providers document 152 and 66 per segment, which fits a header one byte longer.
- Labels for hidden characters are best effort and depend on the Unicode data of the running engine. Counts never depend on the labels.

## Reference implementation (JavaScript)

The function below calculates SMS encoding, length, and segment count using the rules described above. The code picks the encoding, measures every character in that encoding, and fills the segments forward with whole characters, so a character that does not fit starts the next segment. The same code lives in `analyze-sms.js`.

The code and the tests are companions to the text above. The code states the segmentation rules in executable form. The test vectors show how messages are split into segments: about 16,700 of them, covering English, Bangla, other scripts, emoji, and the boundaries where a message gains a segment.

- `analyze-sms.js`: the function. In Node, `require("./analyze-sms.js")` gives `analyzeSms`; in a page, a plain script tag defines the function.
- `index.html`: runs the function in a browser. Typing or pasting an SMS body shows the encoding, the number of segments, the size of each segment and the characters grouped by size. Nothing leaves the page.
- `test-analyze-sms.js` with `test-vectors.json`: each vector holds a message with its expected encoding, length, segment count and segment sizes. Run with `node --test test-analyze-sms.js`.

```javascript
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
```

---

## Sources

- [3GPP TS 23.038](https://www.etsi.org/deliver/etsi_ts/123000_123099/123038/18.00.00_60/ts_123038v180000p.pdf) defines the two alphabets and the 16-bit UCS2 coding of ISO/IEC 10646.
- [3GPP TS 23.040](https://www.etsi.org/deliver/etsi_ts/123000_123099/123040/18.00.00_60/ts_123040v180000p.pdf), clause 9.2.3.24.1, gives 153 and 67 per segment and forbids splitting an escape-sequence character or a UCS2 character.
- 3GPP names the encoding UCS-2, a 16-bit coding based on ISO/IEC 10646, and says nothing about characters above `U+FFFF`. The Unicode Standard defines UTF-16, in which such a character takes two 16-bit code units, a surrogate pair, and the counting here follows that: [Unicode Standard 17.0, section 2.5.2](https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-2/).
- Providers document the same length of 2 (32 bits): [Telnyx](https://developers.telnyx.com/docs/messaging/messages/message-encoding), [Customer.io](https://docs.customer.io/messaging/channels/sms/character-encoding/), [seven](https://help.seven.io/en/sms/send-emojis), [Twilio](https://www.twilio.com/en-us/blog/developers/rcs-character-count).
