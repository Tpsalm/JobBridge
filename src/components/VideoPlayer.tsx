interface VideoPlayerProps {
  src: string;
  poster: string;
  title?: string;
  className?: string;
}

export default function VideoPlayer({ src, poster, title, className = '' }: VideoPlayerProps) {
  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-xl bg-black ${className}`}>
      <video
        className="w-full aspect-video object-cover"
        autoPlay
        muted
        loop
        controls
        playsInline
        preload="metadata"
        poster={poster}
        aria-label={title}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support video playback.
      </video>
    </div>
  );
}
