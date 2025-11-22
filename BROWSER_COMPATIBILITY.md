## Browser Compatibility & Gotchas

### ✅ Supported Browsers

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 66+ | Full support |
| Firefox | 61+ | Full support |
| Safari | 14.1+ | Requires user interaction for AudioContext |
| Edge | 79+ | Full support (Chromium-based) |
| Opera | 53+ | Full support |

### 🔍 Known Issues & Workarounds

#### 1. **AudioContext Auto-Suspend (All Browsers)**

**Issue:** Browsers suspend AudioContext by default to save resources.

**Solution:** Our system auto-resumes when decoding. For playback, call `resume()` after user interaction:

```typescript
playButton.addEventListener('click', async () => {
  const context = getAudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
  // Now you can play audio
});
```

**Why:** [Web Audio Autoplay Policy](https://developers.google.com/web/updates/2017/09/autoplay-policy-changes)

---

#### 2. **Safari Requires User Interaction (iOS/macOS)**

**Issue:** Safari won't create or resume AudioContext without user interaction (tap/click).

**Symptom:**
```javascript
// This fails silently on Safari without user interaction
const context = new AudioContext(); // state = "suspended"
```

**Solution:** Always initialize audio in a user event handler:

```typescript
document.addEventListener('click', async () => {
  const context = getAudioContext();
  await context.resume();
  // Now you can load and play audio
}, { once: true }); // Only needed once
```

**Testing:** Add a "Start Audio" button in your UI.

---

#### 3. **Mobile Safari Memory Limits**

**Issue:** iOS Safari has strict memory limits (~150-300MB for audio).

**Symptoms:**
- Crashes when loading many large files
- `decodeAudioData` fails with no error message
- Browser tab reloads unexpectedly

**Solution:** Use the AudioBufferCache with conservative limits:

```typescript
const cache = new AudioBufferCache({
  maxSize: 30,              // Fewer files on mobile
  maxMemoryBytes: 50 * 1024 * 1024  // 50MB limit
});

// Load files in smaller batches
const loader = createAudioLoader({ maxConcurrent: 3 }); // Lower on mobile
```

**Detection:**
```typescript
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const maxConcurrent = isMobile ? 3 : 6;
const maxMemory = isMobile ? 50 * 1024 * 1024 : 200 * 1024 * 1024;
```

---

#### 4. **CORS Restrictions**

**Issue:** Loading audio from different domains requires CORS headers.

**Symptom:**
```
Access to fetch at 'https://other-domain.com/audio.mp3' from origin 'https://your-site.com'
has been blocked by CORS policy
```

**Solution:** Server must send proper headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
```

**Workaround:** Host audio files on same domain or use a proxy.

---

#### 5. **File Format Support**

**Supported Everywhere:**
- MP3 (MPEG-1/2 Audio Layer 3)
- WAV (PCM, uncompressed)

**Partial Support:**
- OGG Vorbis (no Safari)
- AAC/M4A (varies)
- FLAC (Chrome/Edge only)

**Recommendation:** Use MP3 for web (broad support, good compression).

---

#### 6. **Maximum Concurrent Requests**

**Issue:** Browsers limit concurrent HTTP requests per domain.

| Browser | Limit |
|---------|-------|
| Chrome | 6 per domain |
| Firefox | 6 per domain |
| Safari | 6 per domain |

**Our Solution:** AudioBufferLoader respects `maxConcurrent` (default: 6).

**For CDN:** Use domain sharding:
```typescript
const domains = ['cdn1.example.com', 'cdn2.example.com', 'cdn3.example.com'];
const url = `https://${domains[id % 3]}/audio/${id}.mp3`;
```

---

#### 7. **Decode Failures on Large Files**

**Issue:** Very large files (>50MB) may fail to decode on mobile.

**Solution:**
- Compress files appropriately
- Use lower bitrates for mobile (96-128kbps vs 192-320kbps)
- Split very long tracks into segments

```typescript
// Detect and handle decode failures
try {
  await loader.load(requests);
} catch (error) {
  if (error instanceof DecodeError) {
    console.error('File too large or corrupted:', error.url);
    // Try loading a lower-quality version
  }
}
```

---

#### 8. **Background Tab Throttling**

**Issue:** Browsers throttle background tabs, affecting timing.

**Impact:**
- `setTimeout` may be delayed
- Audio scheduling can drift

**Our Solution:** Web Audio API uses its own precise clock (`AudioContext.currentTime`), which isn't throttled.

**For UI Updates:** Use `requestAnimationFrame` instead of `setInterval` in visible tabs.

---

#### 9. **Offline Support (PWA)**

**Issue:** Loading fails when offline unless files are cached.

**Solution:** Use Service Worker to cache audio files:

```javascript
// service-worker.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('audio-v1').then((cache) => {
      return cache.addAll([
        '/music/00000001-lead.mp3',
        '/music/00000001-body.mp3',
        // ... all your audio files
      ]);
    })
  );
});
```

---

#### 10. **Memory Leaks (Developer Error)**

**Issue:** AudioBuffers stay in memory forever if not released.

**Prevention:**
```typescript
// Bad: Keeping references indefinitely
const allBuffers = new Map();
allBuffers.set(id, buffer); // Never cleared!

// Good: Use cache with limits
const cache = new AudioBufferCache({ maxSize: 50 });
cache.set(id, result); // Auto-evicts old entries

// When done:
cache.dispose(); // Clear everything
```

**Testing:** Open DevTools → Memory → Take Heap Snapshot

---

### 📱 Mobile-Specific Recommendations

#### iOS Safari
```typescript
const loader = createAudioLoader({
  maxConcurrent: 3,        // iOS can handle fewer concurrent loads
  defaultTimeout: 15000,   // Give more time for slower connections
  defaultRetries: 2,       // Fewer retries to fail faster
});

const cache = new AudioBufferCache({
  maxSize: 20,             // Keep fewer files in memory
  maxMemoryBytes: 40 * 1024 * 1024  // 40MB limit
});
```

#### Android Chrome
```typescript
const loader = createAudioLoader({
  maxConcurrent: 4,
  defaultTimeout: 12000,
});

const cache = new AudioBufferCache({
  maxSize: 30,
  maxMemoryBytes: 60 * 1024 * 1024  // 60MB
});
```

---

### 🧪 Testing Checklist

Before deploying:

- [ ] Test in Chrome Desktop
- [ ] Test in Firefox Desktop
- [ ] Test in Safari Desktop
- [ ] Test on iPhone Safari (iOS 14+)
- [ ] Test on Android Chrome
- [ ] Test with slow 3G throttling (DevTools)
- [ ] Test with offline mode (Service Worker)
- [ ] Test with 100+ concurrent files
- [ ] Monitor memory usage (DevTools Memory tab)
- [ ] Test AudioContext resume after tab switch
- [ ] Test with CORS from CDN
- [ ] Test error handling (404, timeout, decode failure)

---

### 🔧 Debug Tips

#### Check AudioContext State
```typescript
const context = getAudioContext();
console.log('State:', context.state); // "running", "suspended", or "closed"
console.log('Sample rate:', context.sampleRate);
console.log('Current time:', context.currentTime);
```

#### Monitor Memory Usage
```typescript
loader.on('fileLoaded', (result) => {
  const sizeKB = (result.buffer.length * result.buffer.numberOfChannels * 4) / 1024;
  console.log(`Loaded ${result.id}: ${sizeKB.toFixed(0)}KB`);
});

const cache = new AudioBufferCache({ maxSize: 50 });
setInterval(() => {
  const stats = cache.getStats();
  console.log(`Cache: ${stats.size} files, ${stats.memoryMB}MB`);
}, 5000);
```

#### Detect Decode Failures
```typescript
loader.on('fileFailed', (failure) => {
  if (failure.error instanceof DecodeError) {
    console.error('Decode failed:', failure.url);
    // File is corrupted or unsupported format
  }
});
```

---

### 📚 Additional Resources

- [Web Audio API Spec](https://www.w3.org/TR/webaudio/)
- [Chrome Audio Best Practices](https://developer.chrome.com/blog/autoplay/)
- [iOS Web Audio Gotchas](https://paulbakaus.com/tutorials/html5/web-audio-on-ios/)
- [Can I Use: Web Audio API](https://caniuse.com/audio-api)

---

### ⚠️ Not Supported

- **Internet Explorer** - No Web Audio API support
- **Opera Mini** - Proxy browser, limited API support
- **UC Browser** - Partial/buggy support
- **Old Android (<5.0)** - Limited or no support

For these browsers, consider a fallback using `<audio>` element:

```typescript
if (!window.AudioContext && !window.webkitAudioContext) {
  // Fallback to HTML5 Audio
  const audio = new Audio();
  audio.src = url;
  audio.play();
}
```
