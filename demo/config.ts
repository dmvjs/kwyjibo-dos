/**
 * Configuration for the Kwyjibo player
 */

// Base URL for music files
// Change this to your CDN or server URL
// Examples:
//   - '/music/' (relative, music in same domain)
//   - 'https://cdn.example.com/music/' (absolute, external CDN)
export const MUSIC_BASE_URL = import.meta.env.VITE_MUSIC_BASE_URL || '/music/';
