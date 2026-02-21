// YouTube transcript extraction
// Runs in content script context (ISOLATED world) on youtube.com/watch pages
// Parses ytInitialPlayerResponse from <script> tags — no API key needed

(function () {
  'use strict';

  function parsePlayerResponse() {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      // Try ytInitialPlayerResponse first
      const match = text.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch (e) {
          // JSON parse failed, try next script
        }
      }
    }
    // Fallback: try a more permissive regex allowing whitespace before semicolon
    for (const script of document.querySelectorAll('script')) {
      const text = script.textContent || '';
      const match = text.match(/ytInitialPlayerResponse\s*=\s*(\{.+\})\s*;/s);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch (e) {
          // continue
        }
      }
    }
    return null;
  }

  function getVideoDetails(playerResponse) {
    const details = playerResponse?.videoDetails;
    return {
      title: details?.title || document.title.replace(/ - YouTube$/, ''),
      channel: details?.author || '',
      videoId: details?.videoId || '',
    };
  }

  function getCaptionTrackUrl(playerResponse) {
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) return null;

    // Prefer English, then first available
    const enTrack = tracks.find(t => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
    const track = enTrack || tracks[0];
    return track?.baseUrl || null;
  }

  function parseTranscriptXml(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const textElements = doc.querySelectorAll('text');
    const segments = [];

    for (const el of textElements) {
      const start = parseFloat(el.getAttribute('start') || '0');
      const dur = parseFloat(el.getAttribute('dur') || '0');
      // Decode HTML entities in transcript text
      let text = el.textContent || '';
      text = text.replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n/g, ' ')
        .trim();

      if (text) {
        segments.push({ start, dur, text });
      }
    }
    return segments;
  }

  // Expose as global for content.js to call
  window.__mdyoink_extractYouTubeTranscript = async function () {
    const playerResponse = parsePlayerResponse();
    if (!playerResponse) {
      return { error: 'Could not find video data on this page' };
    }

    const videoDetails = getVideoDetails(playerResponse);
    const captionUrl = getCaptionTrackUrl(playerResponse);

    if (!captionUrl) {
      return {
        error: 'No transcript available for this video',
        title: videoDetails.title,
        channel: videoDetails.channel,
      };
    }

    try {
      const response = await fetch(captionUrl);
      if (!response.ok) {
        return { error: 'Failed to fetch transcript' };
      }
      const xmlText = await response.text();
      const segments = parseTranscriptXml(xmlText);

      if (segments.length === 0) {
        return { error: 'Transcript was empty' };
      }

      return {
        title: videoDetails.title,
        channel: videoDetails.channel,
        url: window.location.href,
        segments,
        isYouTube: true,
      };
    } catch (e) {
      return { error: 'Failed to load transcript: ' + e.message };
    }
  };
})();
