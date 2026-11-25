# Beyond Character Counting: How SMS Segments Work

An SMS that appears as one message on a phone may travel through the network as several smaller pieces. Each piece, called a segment, has a fixed amount of room. The receiving phone joins the pieces again before displaying the message, so the split remains invisible.

A single-segment SMS holds 1120 bits (140 bytes), a limit set by the protocol. Characters take different numbers of bits, depending on their encoding. The encoding determines how many characters fit in a segment.

Standard text messages use one of two encodings: GSM-7 or UCS-2. Messages containing English letters, numbers, and standard symbols are usually sent using GSM-7. Messages containing emojis or characters from languages such as Bangla, Japanese, Arabic, and Chinese use Unicode (UCS-2). A UCS-2 message may still contain GSM-7 characters, but must contain at least one character that GSM-7 cannot encode.

When a message needs more than one segment, every segment carries a small header. The header identifies the parts of the message and lets the receiving phone reassemble them in the correct order. Because the header occupies part of each segment, it leaves less room for the message content.

## GSM-7 encoding

In GSM-7, a character’s length is the number of bits it takes in an SMS segment. Most characters take 7 bits; a small number take 14 bits. The following characters have a length of 1 (7 bits). They are the 127 characters of the GSM-7 basic character set. Together with the escape control code (ESC, 0x1B), they fill its 128 values.

- Letters and digits: `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`
- Space (SP): `0x20`
- Line feed (LF): `0x0A`
- Carriage return (CR): `0x0D`
- Punctuation, symbols and accented letters: `@£$¥_!"#¤%&'()*+,-./:;<=>?¡§¿èéùìòÇØøÅåÆæßÉÄÖÑÜäöñüàΔΦΓΛΩΠΨΣΘΞ`

The GSM-7 extended character set has 10 characters, each with a length of 2 (14 bits). Each is sent as an escape code (`ESC`) followed by the character itself: 7 bits x 2 = 14 bits. The 10 characters are:

- Printable characters: `€{}[]\^~|`
- Form feed (FF): `0x1B 0x0A`

A single-segment SMS made only of basic characters holds a maximum of 1120 bits / 7 bits = 160 characters. One extended character lowers the maximum: it takes 14 bits and counts as 1 character. The remaining 1106 bits hold 158 basic characters, so the maximum becomes 159 characters.

## UCS-2 encoding

If an SMS contains at least one character outside the GSM-7 character set—such as an emoji, ç, á, or a curly quotation mark—UCS-2 encoding is used. In UCS-2, each character occupies either 16 bits (a length of 1) or 32 bits (a length of 2). Characters in the Basic Multilingual Plane (BMP) take 16 bits. The BMP is the Unicode range that encompasses nearly all modern languages, punctuation, basic symbols, and some emojis. Characters outside the BMP—including newer emojis, rare ideographs, and ancient scripts—occupy 32 bits. GSM-7 characters are a subset of the BMP.

A single-segment SMS can hold a maximum of 1120 bits / 16 bits = 70 BMP characters. One surrogate pair reduces this maximum: it occupies 32 bits and counts as 1 character. The remaining 1088 bits can hold 68 BMP characters, making the maximum 69 characters.

A single-segment SMS can hold a maximum of 1120 bits / 16 bits = 70 characters. One character outside the BMP reduces this maximum: it occupies 32 bits and counts as 1 character. The remaining 1088 bits can hold 68 characters, making the maximum 69 characters.

## Splitting long messages into segments

When the content exceeds 1120 bits, the SMS is divided into multiple segments, and a header is added to each segment. This header, known as the User Data Header (UDH), occupies 48 bits and enables the receiving phone to reassemble the segments in the correct order.

For GSM-7, one alignment bit is added to the header. Because 7-bit characters must begin on a 7-bit boundary, and the next boundary after 48 bits is at 49 bits, the header occupies 49 bits. This leaves 1120 bits - 49 bits = 1071 bits, sufficient for 1071 bits / 7 bits = 153 basic characters. An extended character reduces this maximum: it occupies 14 bits but counts as one character. The remaining 1057 bits accommodate 151 basic characters, bringing the maximum to 152 characters.

For UCS-2, no alignment bit is required because 48 bits is already a multiple of 16. The header therefore remains 48 bits, leaving 1,120 bits - 48 bits = 1072 bits, which is enough for 1072 bits / 16 bits = 67 BMP characters. A surrogate pair reduces this maximum: it occupies 32 bits but counts as one character. The remaining 1040 bits accommodate 65 BMP characters, bringing the maximum to 66 characters.

Segments are filled using whole characters. If the next character does not fit in the available space, it begins in the next segment; consequently, a segment may close before its full capacity has been used.

## Example: splitting a GSM-7 message

Consider a GSM-7 SMS that exceeds the single-segment limit of 1120 bits.

The SMS contains 152 basic characters, followed by one € (a GSM-7 extended character), and then 152 additional basic characters. This amounts to 305 characters, but a total length of 306 units (2142 bits), because € is encoded using two units (14 bits).

| Content | Characters | Length | Bits |
|---|---:|---:|---:|
| Basic characters | 304 | 304 | 2128 |
| Extended character € | 1 | 2 | 14 |
| **Total** | **305** | **306** | **2142** |

After the 49-bit header, each segment has 1071 bits available for content.

- Segment 1 takes the first 152 basic characters: 152 x 7 bits = 1064 bits. Only 7 bits remain.
- The € needs 14 bits. It does not fit in the remaining 7 bits, so it moves to segment 2.
- Segment 2 takes the € (14 bits) and 151 basic characters (1057 bits): 1071 bits, exactly full. That is 152 characters with a length of 153, because the € counts as 2.
- Segment 3 takes the last character: 7 bits.

Result: Three segments, with lengths of 152 (1064 bits), 153 (1071 bits), and 1 (7 bits). Simple division underestimates the required number of segments: the total length of 306 (2142 bits), divided by the segment capacity of 153 (1071 bits), yields exactly two. The discrepancy arises because the final 7 bits of segment 1 remain unused, causing the last character to be placed in a third segment.

## Bit usage at a glance

| Parameter | GSM-7 | UCS-2 |
|---|---:|---:|
| Header, single segment (bits) | 0 | 0 |
| Header, multi-segment (bits) | 49 | 48 |
| GSM-7 basic character (bits) | 7 | 16 |
| GSM-7 extended character (bits) | 14 | 16 |
| Basic Multilingual Plane (BMP) | N/A | 16 |
| Beyond BMP | N/A | 32 |
| Characters in a single-segment SMS | 160 | 70 |
| Characters per segment in a multi-segment SMS | 153 | 67 |

The character counts assume the smallest character size: basic GSM-7 characters, or Unicode characters from the BMP.

## Scope and limits

- Covered: the GSM-7 basic and extended character sets, and UCS-2 with surrogate pairs.
- Not covered: national language shift tables (Turkish, Spanish, Portuguese and others). Text that needs such tables is counted here as Unicode.
- Not covered: operator and provider behaviour. Counting follows 3GPP TS 23.038 and 23.040, and a given network may differ.
- Not covered: other header sizes. The header here is 6 bytes (48 bits), which gives 153 and 67 per segment. Some providers document 152 and 66 per segment, which fits a header one byte longer.

## Reference implementation (JavaScript)

The function below calculates the encoding, length, and segment count of an SMS using the rules described above. It selects the encoding, measures each character in that encoding, and fills the segments sequentially with whole characters. The same code lives in `analyze-sms.js`.

The tests and the browser page are companions to the code. The 16718 test vectors show how messages are split into segments. They cover English, Bangla, other scripts, emoji, and the boundaries at which a message is segmented.

- `analyze-sms.js`: the function. In Node, `require("./analyze-sms.js")` gives `analyzeSms`; in a page, a plain script tag defines the function.
- `index.html`: runs the function in a browser. Typing or pasting an SMS body shows the encoding, the number of segments, the size of each segment, and the characters grouped by size. Characters that cannot be seen appear as `Non-Printable: U+XXXX`. These labels are best effort and depend on the Unicode data of the running engine, but counts never depend on them. Nothing leaves the page.
- `test-analyze-sms.js` with `test-vectors.json`: each vector holds a message with its expected encoding, length, segment count, and segment sizes. Run with `node --test test-analyze-sms.js`.

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
