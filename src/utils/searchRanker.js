/**
 * searchRanker.js
 * Smart query normalization, natural language parsing, & relevance ranking engine for Search.
 * 
 * Features:
 *   1. Clean query noise, connector prepositions ("by", "from"), & broad Hinglish fuzzy typo auto-correction.
 *   2. Rank results by exact title match, artist match, & official hit status.
 *   3. Penalize unwanted remixes/slowed+reverb versions unless requested.
 */

// Broad Hinglish fuzzy typos / phonetics map
const QUERY_ALIASES = [
  [/\b(kersaiya|kesriya|kesariiya|kesria|kesariyaa)\b/gi, 'kesariya'],
  [/\b(arijit shing|arjit singh|arijeet|arijit sing)\b/gi, 'arijit singh'],
  [/\b(shreya gosal|shreya gosal|shreyaghoshal)\b/gi, 'shreya ghoshal'],
  [/\b(sidhu musewala|sidhu moosewala|sidhumoosewala)\b/gi, 'sidhu moose wala'],
  [/\b(tumhiho|tumhi ho|tum h ho)\b/gi, 'tum hi ho'],
  [/\b(ap dillon|app dhillon|apdhillon)\b/gi, 'ap dhillon'],
  [/\b(jubin nutiyal|jubin nautiyal|jubinnautiyal)\b/gi, 'jubin nautiyal'],
  [/\b(neha kakar|nehakakkar)\b/gi, 'neha kakkar'],
  [/\b(jonita gandhi|jonitagandhi)\b/gi, 'jonita gandhi'],
  [/\b(baadshah|badshahh)\b/gi, 'badshah'],
  [/\b(hony singh|yoyo honey singh|yoyo honeysingh)\b/gi, 'yo yo honey singh'],
  [/\b(pasoori|pasuri|pasori)\b/gi, 'pasoori'],
  [/\b(channa mereya|chana mereya|chanamereya)\b/gi, 'channa mereya'],
  [/\b(diljit dosanj|diljeet|diljitdosanjh)\b/gi, 'diljit dosanjh'],
];

// Noise words & prepositions to strip from query so combined search hits JioSaavn correctly
const NOISE_WORDS = /\b(full song|official video|official song|hd video|mp3|lyric video|lyrics|audio|song|video|download|by|from|sung by)\b/gi;

/**
 * Clean & normalize raw search query.
 */
export function cleanSearchQuery(query = '') {
  if (!query) return '';
  let cleaned = query.trim().toLowerCase();

  // Strip noise & connector words
  cleaned = cleaned.replace(NOISE_WORDS, ' ').trim();

  // Apply Hinglish alias fixes
  for (const [regex, replacement] of QUERY_ALIASES) {
    cleaned = cleaned.replace(regex, replacement);
  }

  // Normalize multiple spaces
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Calculate relevance score for a song relative to user query.
 */
export function getRelevanceScore(song, rawQuery) {
  if (!song || !rawQuery) return 0;
  
  const cleaned = cleanSearchQuery(rawQuery);
  const terms = cleaned.split(' ').filter(Boolean);

  const title = (song.title || song.name || '').toLowerCase().trim();
  const artist = (song.artist || song.primaryArtists || '').toLowerCase().trim();
  const album = (song.album || '').toLowerCase().trim();

  let score = 0;

  // Exact full query match on title (+100)
  if (title === cleaned) {
    score += 100;
  } else if (title.startsWith(cleaned)) {
    score += 60;
  } else if (title.includes(cleaned)) {
    score += 40;
  }

  // Term-by-term scoring: evaluate how many terms match title vs artist
  for (const term of terms) {
    if (term.length <= 1) continue;
    if (title.includes(term)) score += 35;
    if (artist.includes(term)) score += 35;
    if (album.includes(term)) score += 10;
  }

  // Check if query explicitly asks for remix / lofi / slowed
  const isQueryRemix = /\b(remix|lofi|slowed|reverb|cover|instrumental|8d|acoustic)\b/i.test(rawQuery);

  // Penalize unrequested remixes/lofi/slowed versions (-30)
  if (!isQueryRemix) {
    const isSongRemix = /\b(remix|lofi|slowed|reverb|cover|instrumental|8d|mashup|dj)\b/i.test(title);
    if (isSongRemix) {
      score -= 30;
    }
  }

  return score;
}

/**
 * Sort search results by relevance score.
 */
export function rankSearchResults(songs = [], rawQuery = '') {
  if (!Array.isArray(songs) || songs.length === 0 || !rawQuery) {
    return songs || [];
  }

  const scored = songs.map((song, index) => {
    const score = getRelevanceScore(song, rawQuery);
    return {
      song: { ...song, _relevanceScore: score },
      index,
      score
    };
  });

  // Sort descending by score, tie-break by original index
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.index - b.index;
  });

  return scored.map(item => item.song);
}
