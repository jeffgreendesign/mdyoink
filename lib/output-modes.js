// Output mode post-processing transforms
// Pure string operations — no DOM needed

export const MODEL_CONTEXTS = {
  'Claude 200k': 200000,
  'GPT-4 128k': 128000,
  'GPT-4o 128k': 128000,
  'Gemini 1M': 1000000,
  'Llama 10M': 10000000,
};

export const DEFAULT_SETTINGS = {
  outputMode: 'llm',
  llm: {
    stripLinks: true,
    stripImages: true,
    stripFrontMatter: true,
    sourceLineFormat: 'Source: {url}',
  },
  obsidian: {
    frontMatterTemplate: '---\ntitle: {title}\nurl: {url}\ndate: {date:YYYY-MM-DD}\n---',
  },
  tokenCounter: {
    model: 'Claude 200k',
    show: true,
  },
  markdown: {
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    linkStyle: 'inlined',
    includeImages: true,
  },
  downloads: {
    filenameTemplate: '{title}',
  },
  youtube: {
    timestamps: 'obsidian', // 'always' | 'obsidian' | 'never'
    format: 'auto', // 'auto' | 'paragraphs' | 'timestamped'
  },
};

export function stripLinks(markdown) {
  let result = markdown;
  // Strip markdown links: [text](url) → text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Strip bare autolinks: <https://example.com>
  result = result.replace(/<https?:\/\/[^>]+>/g, '');
  // Strip reference-style link definitions: [1]: https://...
  result = result.replace(/^\[[^\]]+\]:\s+.*$/gm, '');
  return result;
}

export function stripImages(markdown) {
  // Strip markdown images: ![alt](src)
  return markdown.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
}

export function formatDate(format) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  if (!format || format === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }
  if (format === 'YYYY-MM-DDTHH:mm:ss') {
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }
  // Default ISO date
  return `${year}-${month}-${day}`;
}

function replaceFrontMatterVars(template, metadata) {
  let result = template;
  result = result.replace(/\{title\}/g, metadata.title || 'Untitled');
  result = result.replace(/\{url\}/g, metadata.url || '');
  result = result.replace(/\{domain\}/g, metadata.domain || '');
  result = result.replace(/\{selection\}/g, metadata.selection || '');

  // Handle date with optional format: {date} or {date:FORMAT}
  result = result.replace(/\{date(?::([^}]+))?\}/g, (_, fmt) => formatDate(fmt));

  return result;
}

export function applyLLMMode(markdown, metadata, settings) {
  const llmSettings = settings?.llm || DEFAULT_SETTINGS.llm;
  let result = markdown;

  if (llmSettings.stripImages) {
    result = stripImages(result);
  }
  if (llmSettings.stripLinks) {
    result = stripLinks(result);
  }

  // Clean up excessive blank lines from stripping
  result = result.replace(/\n{3,}/g, '\n\n');

  // Prepend source line
  if (llmSettings.sourceLineFormat) {
    const sourceLine = llmSettings.sourceLineFormat
      .replace(/\{url\}/g, metadata.url || '')
      .replace(/\{title\}/g, metadata.title || '')
      .replace(/\{domain\}/g, metadata.domain || '');
    result = sourceLine + '\n\n' + result.trim();
  }

  return result;
}

export function applyObsidianMode(markdown, metadata, settings) {
  const obsSettings = settings?.obsidian || DEFAULT_SETTINGS.obsidian;
  const template = obsSettings.frontMatterTemplate || DEFAULT_SETTINGS.obsidian.frontMatterTemplate;
  const frontMatter = replaceFrontMatterVars(template, metadata);
  return frontMatter + '\n\n' + markdown.trim();
}

export function applyRawMode(markdown) {
  return markdown.trim();
}

export function applyMode(mode, markdown, metadata, settings) {
  switch (mode) {
    case 'llm':
      return applyLLMMode(markdown, metadata, settings);
    case 'obsidian':
      return applyObsidianMode(markdown, metadata, settings);
    case 'raw':
      return applyRawMode(markdown);
    default:
      return applyRawMode(markdown);
  }
}

export function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

export function slugifyFilename(title) {
  if (!title) return 'untitled.md';
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  if (!slug) slug = 'untitled';
  return slug + '.md';
}

export function formatYouTubeTranscript(data, mode, settings) {
  const ytSettings = settings?.youtube || DEFAULT_SETTINGS.youtube;
  const { title, channel, url, segments } = data;

  const showTimestamps = ytSettings.timestamps === 'always' ||
    (ytSettings.timestamps === 'obsidian' && mode === 'obsidian');

  const useTimestamped = ytSettings.format === 'timestamped' ||
    (ytSettings.format === 'auto' && mode === 'obsidian');

  let transcript = '';
  if (showTimestamps && useTimestamped) {
    // Timestamped lines
    transcript = segments.map(s => {
      const mins = Math.floor(s.start / 60);
      const secs = Math.floor(s.start % 60);
      const ts = `${mins}:${String(secs).padStart(2, '0')}`;
      return `[${ts}] ${s.text}`;
    }).join('\n');
  } else {
    // Flowing paragraphs
    transcript = segments.map(s => s.text).join(' ');
    // Break into paragraphs roughly every 5 sentences
    transcript = transcript.replace(/([.!?])\s+/g, (match, p) => {
      return p + ' ';
    });
  }

  let markdown = `## ${title}\n\n`;
  markdown += `Source: ${url}\n`;
  if (channel) {
    markdown += `Channel: ${channel}\n`;
  }
  markdown += `\n### Transcript\n\n${transcript}`;

  return { markdown, title, url, channel, isYouTube: true };
}
