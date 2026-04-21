import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

const STREAM_URL = 'https://stream.mux.com/tLkHO1qZoaaQOUeVWo8hEBeGQfySP02EPS02BmnNFyXys.m3u8';

export default function VideoBackground() {
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Fully reset the video element before attaching a new HLS instance.
    // This handles React StrictMode's double-invoke cleanly.
    v.removeAttribute('src');
    v.load();

    const onPlay = () => setReady(true);
    v.addEventListener('playing', onPlay);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        lowLatencyMode: false,
        startLevel: -1,
      });
      hlsRef.current = hls;

      hls.loadSource(STREAM_URL);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) hls.destroy();
      });
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      v.src = STREAM_URL;
      v.play().catch(() => {});
    }

    return () => {
      v.removeEventListener('playing', onPlay);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      v.removeAttribute('src');
      v.load();
    };
  }, []);

  return (
    <>
      {/* Animated gradient — always visible as fallback if stream is slow/unavailable */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: [
          'radial-gradient(ellipse at 15% 50%, rgba(94,210,156,0.10) 0%, transparent 55%)',
          'radial-gradient(ellipse at 85% 20%, rgba(56,189,248,0.06) 0%, transparent 50%)',
          '#050908',
        ].join(', '),
        animation: 'heroPulse 7s ease-in-out infinite alternate',
      }} />

      {/* HLS video — fades in once playing */}
      <video
        ref={videoRef}
        autoPlay muted loop playsInline
        crossOrigin="anonymous"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: ready ? 0.55 : 0,
          transition: 'opacity 1.2s ease',
          zIndex: 0,
        }}
      />
    </>
  );
}
