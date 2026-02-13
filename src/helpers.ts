export const getAppHomeURL = () => {
  return new URL(window.location.href).origin + process.env.PUBLIC_URL;
};

export const getQueryParam = (name: string) => {
  return getParam(name, window.location.search);
};

export const getHashParam = (name: string) => {
  return getParam(name, window.location.hash);
};

const getParam = (name: string, value: string) => {
  name = name.replace(/[[]/, '\\[').replace(/[\]]/, '\\]');
  var regex = new RegExp('[\\?&#]' + name + '=([^&#]*)'),
    results = regex.exec(value);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

export const colors: string[] = ['#D23F9A', '#7FBB61', '#2C75C2', '#F2A83A', '#6456F1', '#19E3B2', '#FA6B4D', '#8C84D4', '#D3F721', '#4A4A47'];

// light clean + trailing parts (- X || (X))
export const cleanValue = (value: string) => {
  return cleanValueLight(value.replaceAll(/ \(.+\).*| \[.+\].*| -.+/g, '')).trim();
};

// lower-case + remove diacritic + remove some special characters
export const cleanValueLight = (value: string) => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[!?]+$/g, '')
    .replaceAll(/^[!?]+/g, '')
    .replaceAll(/ [!?]+/g, ' ')
    .replaceAll(/[!?]+ /g, ' ')
    .replaceAll(/[¿¡*,.'':_/-]/g, '')
    .replaceAll('œ', 'oe')
    .replaceAll(/[$]/g, 's')
    .replaceAll(/[ø]/g, 'o')
    .trim();
};

// Remove articles (le, la, les, un, une, des, l', the, a, an) for more permissive matching
export const removeArticles = (value: string) => {
  return value
    .replace(/^le /i, '')
    .replace(/^la /i, '')
    .replace(/^les /i, '')
    .replace(/^un /i, '')
    .replace(/^une /i, '')
    .replace(/^des /i, '')
    .replace(/^l'/i, '')
    .replace(/^the /i, '')
    .replace(/^a /i, '')
    .replace(/^an /i, '')
    .trim();
};

export const specialCharactersAlternatives = new Map<RegExp, string[]>([
  [/ & /g, [' and ', ' et ']],
  [/ \+ /g, [' and ', ' et ']],
  [/^the /g, ['']],
]);

export const cleanSpoiler = (title: string, artists: string[]) => {
  let cleaned = title;
  for (let artist of artists) {
    var escapedArtist = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regExp = new RegExp(` \\(.*${escapedArtist}.*\\)| \\[.*${escapedArtist}.*\\]| - .*${escapedArtist}.*`, 'gi');
    cleaned = cleaned.replaceAll(regExp, '').trim();
  }
  return cleaned;
};

// ref, input
export const sorensenDiceScore = (first: string, second: string) => {
  first = first.replace(/\s+/g, '');
  second = second.replace(/\s+/g, '');

  if (first === second) return 1;
  if ((first.length < 2 && second.length >= 2) || second.length > 100) return 0;

  let firstBigrams = new Map();
  let firstReverseBigrams = new Map();
  let firstAltBigrams = new Map();
  for (let i = 0; i < first.length - 1; i++) {
    const bigram = first[i] + first[i + 1];
    const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) + 1 : 1;
    firstBigrams.set(bigram, count);

    const reverseBigram = first[i + 1] + first[i];
    const reverseCount = firstReverseBigrams.has(reverseBigram) ? firstReverseBigrams.get(reverseBigram) + 1 : 1;
    firstReverseBigrams.set(reverseBigram, reverseCount);

    if (i + 2 < first.length) {
      const altBigram = first[i] + first[i + 2];
      const altCount = firstAltBigrams.has(altBigram) ? firstAltBigrams.get(altBigram) + 1 : 1;
      firstAltBigrams.set(altBigram, altCount);
    }
  }


  let intersectionSize = 0;
  const altRatio = Math.max(0.2, 1.0 - 0.05 * first.length);

  for (let i = 0; i < second.length - 1; i++) {
    const bigram = second[i] + second[i + 1];

    if (firstBigrams.has(bigram)) {
      const count = firstBigrams.get(bigram);
      if (count > 0) {
        firstBigrams.set(bigram, count - 1);
        intersectionSize++;
        continue;
      }
    }
    if (firstReverseBigrams.has(bigram)) {
      const count = firstReverseBigrams.get(bigram);
      if (count > 0) {
        firstReverseBigrams.set(bigram, count - 1);
        intersectionSize += altRatio;
        continue;
      }
    }
    if (firstAltBigrams.has(bigram)) {
      const count = firstAltBigrams.get(bigram);
      if (count > 0) {
        firstAltBigrams.set(bigram, count - 1);
        intersectionSize += altRatio;
      }
    }
  }

  return (2.0 * intersectionSize) / (first.length + second.length - 2);
};