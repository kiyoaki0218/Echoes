"use client";

import { useEffect, useState, Suspense, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getActiveAnnouncements, type Announcement } from "@/app/actions/admin";
import { PenTool, X, Heart, Trash2, ChevronDown, ChevronUp, ExternalLink, Search, Flag, Megaphone, Pin, ChevronLeft, ChevronRight, Star } from "lucide-react";

type Mode = "bubble" | "will";
type DisplayMode = "all" | "bubble" | "will";

type MediaEmbedType =
  | { type: "youtube"; id: string }
  | { type: "spotify"; subType: string; id: string }
  | { type: "x"; id: string }
  | { type: "instagram"; code: string }
  | { type: "niconico"; id: string }
  | { type: "vimeo"; id: string }
  | { type: "tiktok"; id: string }
  | { type: "soundcloud"; url: string }
  | { type: "twitch"; kind: "video" | "clip"; id: string }
  | { type: "bilibili"; bvid: string }
  | { type: "apple_music"; path: string }
  | { type: "amazon_music"; url: string }
  | { type: "voicy"; channelId: string; episodeId: string }
  | { type: "stand_fm"; id: string }
  | { type: "pinterest"; id: string }
  | { type: "giphy"; id: string }
  | { type: "docswell"; id: string }
  | { type: "codepen"; user: string; id: string }
  | { type: "figma"; url: string }
  | { type: "google_maps"; queryUrl: string };

function parseMediaEmbed(url: string): MediaEmbedType | null {
  try {
    const cleanUrl = url.replace(/[),;.]+$/, "");
    const parsed = new URL(cleanUrl);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;
    const parts = pathname.split("/").filter(Boolean);

    // 1. YouTube
    if (host.includes("youtube.com")) {
      if (pathname.startsWith("/watch")) {
        const v = parsed.searchParams.get("v");
        if (v) return { type: "youtube", id: v };
      }
      if (pathname.startsWith("/shorts/") || pathname.startsWith("/embed/")) {
        if (parts[1]) return { type: "youtube", id: parts[1] };
      }
    } else if (host.includes("youtu.be")) {
      const id = parts[0]?.split("?")[0];
      if (id) return { type: "youtube", id };
    }

    // 2. Spotify (/intl-ja/track/:id など国言語コード修正)
    if (host.includes("spotify.com")) {
      const types = ["track", "album", "playlist", "episode", "show"];
      for (let i = 0; i < parts.length - 1; i++) {
        if (types.includes(parts[i])) {
          const id = parts[i + 1].split("?")[0];
          return { type: "spotify", subType: parts[i], id };
        }
      }
    }

    // 3. X (Twitter)
    if (host.includes("x.com") || host.includes("twitter.com")) {
      const statusIdx = parts.indexOf("status");
      if (statusIdx !== -1 && parts[statusIdx + 1]) {
        const id = parts[statusIdx + 1].split("?")[0];
        return { type: "x", id };
      }
    }

    // 4. Instagram
    if (host.includes("instagram.com") || host.includes("instagr.am")) {
      if (parts.length >= 2 && (parts[0] === "p" || parts[0] === "reel")) {
        return { type: "instagram", code: parts[1] };
      }
    }

    // 5. ニコニコ動画
    if (host.includes("nicovideo.jp")) {
      if (parts[0] === "watch" && parts[1]) {
        return { type: "niconico", id: parts[1].replace(/^sm/, "") };
      }
    } else if (host.includes("nico.ms")) {
      if (parts[0]) return { type: "niconico", id: parts[0].replace(/^sm/, "") };
    }

    // 6. Vimeo
    if (host.includes("vimeo.com")) {
      if (parts[0] && /^\d+$/.test(parts[0])) {
        return { type: "vimeo", id: parts[0] };
      }
    }

    // 7. TikTok (パース & overload-protect 修正)
    if (host.includes("tiktok.com")) {
      const videoIdx = parts.indexOf("video");
      if (videoIdx !== -1 && parts[videoIdx + 1]) {
        const id = parts[videoIdx + 1].split("?")[0];
        return { type: "tiktok", id };
      }
    }

    // 8. SoundCloud
    if (host.includes("soundcloud.com")) {
      if (parts.length >= 2) {
        return { type: "soundcloud", url: cleanUrl };
      }
    }

    // 9. Twitch
    if (host.includes("twitch.tv")) {
      if (host.includes("clips.twitch.tv")) {
        if (parts[0]) return { type: "twitch", kind: "clip", id: parts[0] };
      }
      const videoIdx = parts.indexOf("videos");
      if (videoIdx !== -1 && parts[videoIdx + 1]) {
        return { type: "twitch", kind: "video", id: parts[videoIdx + 1] };
      }
      const clipIdx = parts.indexOf("clip");
      if (clipIdx !== -1 && parts[clipIdx + 1]) {
        return { type: "twitch", kind: "clip", id: parts[clipIdx + 1] };
      }
    }

    // 10. Bilibili
    if (host.includes("bilibili.com")) {
      const videoIdx = parts.indexOf("video");
      if (videoIdx !== -1 && parts[videoIdx + 1]) {
        const bvid = parts[videoIdx + 1].split("?")[0];
        return { type: "bilibili", bvid };
      }
    }

    // 11. Apple Music
    if (host.includes("music.apple.com")) {
      return { type: "apple_music", path: pathname };
    }

    // 12. Amazon Music
    if (host.includes("music.amazon")) {
      return { type: "amazon_music", url: cleanUrl };
    }

    // 13. Voicy
    if (host.includes("voicy.jp")) {
      const channelIdx = parts.indexOf("channel");
      const epIdx = parts.indexOf("episodes");
      if (channelIdx !== -1 && epIdx !== -1 && parts[channelIdx + 1] && parts[epIdx + 1]) {
        return { type: "voicy", channelId: parts[channelIdx + 1], episodeId: parts[epIdx + 1] };
      }
    }

    // 14. stand.fm
    if (host.includes("stand.fm")) {
      const epIdx = parts.indexOf("episodes");
      if (epIdx !== -1 && parts[epIdx + 1]) {
        return { type: "stand_fm", id: parts[epIdx + 1] };
      }
    }

    // 15. Pinterest
    if (host.includes("pinterest.com") || host.includes("pin.it")) {
      const pinIdx = parts.indexOf("pin");
      if (pinIdx !== -1 && parts[pinIdx + 1]) {
        return { type: "pinterest", id: parts[pinIdx + 1] };
      }
    }

    // 16. Giphy
    if (host.includes("giphy.com") || host.includes("gph.is")) {
      const gifsIdx = parts.indexOf("gifs");
      if (gifsIdx !== -1 && parts[gifsIdx + 1]) {
        const slug = parts[gifsIdx + 1];
        const id = slug.split("-").pop() || slug;
        return { type: "giphy", id };
      }
    }

    // 17. Docswell
    if (host.includes("docswell.com")) {
      const sIdx = parts.indexOf("s");
      if (sIdx !== -1 && parts[sIdx + 2]) {
        return { type: "docswell", id: parts[sIdx + 2] };
      }
    }

    // 18. CodePen
    if (host.includes("codepen.io")) {
      const penIdx = parts.indexOf("pen");
      if (penIdx > 0 && parts[penIdx + 1]) {
        return { type: "codepen", user: parts[penIdx - 1], id: parts[penIdx + 1] };
      }
    }

    // 19. Figma
    if (host.includes("figma.com")) {
      if (parts[0] === "file" || parts[0] === "design" || parts[0] === "proto") {
        return { type: "figma", url: cleanUrl };
      }
    }

    // 20. Google Maps
    if ((host.includes("google.com") && pathname.includes("maps")) || host.includes("maps.app.goo.gl") || host.includes("maps.google")) {
      return { type: "google_maps", queryUrl: cleanUrl };
    }
  } catch {
    // fallback
  }
  return null;
}

function MediaEmbedItem({ embed }: { embed: MediaEmbedType }) {
  const [parentDomain, setParentDomain] = useState("localhost");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setParentDomain(window.location.hostname);
    }
  }, []);

  switch (embed.type) {
    case "youtube":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="relative w-full aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${embed.id}`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; webshare"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      );

    case "spotify":
      const spotifyHeight = embed.subType === "track" ? 152 : 352;
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://open.spotify.com/embed/${embed.subType}/${embed.id}?utm_source=generator&theme=0`}
            width="100%"
            height={spotifyHeight}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="border-0 rounded-xl"
          />
        </div>
      );

    case "x":
      return (
        <div className="mt-3 w-full max-w-md mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-lg min-h-[250px]" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://platform.twitter.com/embed/Tweet.html?id=${embed.id}&theme=dark`}
            width="100%"
            height="320"
            className="border-0 w-full rounded-xl"
            loading="lazy"
            title="X (Twitter) Post"
          />
        </div>
      );

    case "instagram":
      return (
        <div className="mt-3 w-full max-w-sm mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://www.instagram.com/p/${embed.code}/embed`}
            width="100%"
            height="440"
            className="border-0 w-full rounded-xl"
            loading="lazy"
            title="Instagram Post"
          />
        </div>
      );

    case "niconico":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="relative w-full aspect-video">
            <iframe
              src={`https://embed.nicovideo.jp/watch/sm${embed.id}`}
              title="ニコニコ動画"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      );

    case "vimeo":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="relative w-full aspect-video">
            <iframe
              src={`https://player.vimeo.com/video/${embed.id}`}
              title="Vimeo video player"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      );

    case "tiktok":
      return (
        <div className="mt-3 w-full max-w-xs mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://www.tiktok.com/embed/v2/${embed.id}`}
            width="100%"
            height="735"
            className="border-0 w-full rounded-xl"
            allow="autoplay; encrypted-media"
            allowFullScreen
            loading="lazy"
            title="TikTok video"
          />
        </div>
      );

    case "soundcloud":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            width="100%"
            height="166"
            scrolling="no"
            frameBorder="no"
            allow="autoplay"
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(embed.url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
            loading="lazy"
            title="SoundCloud player"
          />
        </div>
      );

    case "twitch":
      const twitchSrc = embed.kind === "clip"
        ? `https://clips.twitch.tv/embed?clip=${embed.id}&parent=${parentDomain}&autoplay=false`
        : `https://player.twitch.tv/?video=${embed.id}&parent=${parentDomain}&autoplay=false`;
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="relative w-full aspect-video">
            <iframe
              src={twitchSrc}
              title="Twitch Player"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      );

    case "bilibili":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="relative w-full aspect-video">
            <iframe
              src={`https://player.bilibili.com/player.html?bvid=${embed.bvid}&page=1&high_quality=1&danmaku=0`}
              title="Bilibili Player"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      );

    case "apple_music":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://embed.music.apple.com${embed.path}`}
            height="175"
            width="100%"
            allow="autoplay *; encrypted-media *; fullscreen *"
            className="border-0 rounded-xl"
            loading="lazy"
            title="Apple Music"
          />
        </div>
      );

    case "amazon_music":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={embed.url}
            height="300"
            width="100%"
            className="border-0 rounded-xl"
            loading="lazy"
            title="Amazon Music"
          />
        </div>
      );

    case "voicy":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://voicy.jp/embed/channel/${embed.channelId}/episode/${embed.episodeId}`}
            width="100%"
            height="180"
            className="border-0 rounded-xl"
            loading="lazy"
            title="Voicy Player"
          />
        </div>
      );

    case "stand_fm":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://stand.fm/embed/episodes/${embed.id}`}
            width="100%"
            height="200"
            className="border-0 rounded-xl"
            loading="lazy"
            title="stand.fm Player"
          />
        </div>
      );

    case "pinterest":
      return (
        <div className="mt-3 w-full max-w-xs mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://assets.pinterest.com/ext/embed.html?id=${embed.id}`}
            height="420"
            width="100%"
            className="border-0 rounded-xl"
            loading="lazy"
            title="Pinterest Pin"
          />
        </div>
      );

    case "giphy":
      return (
        <div className="mt-3 w-full max-w-md mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="relative w-full aspect-video">
            <iframe
              src={`https://giphy.com/embed/${embed.id}`}
              title="Giphy GIF"
              className="absolute top-0 left-0 w-full h-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      );

    case "docswell":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://www.docswell.com/slide/${embed.id}/embed`}
            width="100%"
            height="340"
            className="border-0 rounded-xl"
            allowFullScreen
            loading="lazy"
            title="Docswell Slide"
          />
        </div>
      );

    case "codepen":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://codepen.io/${embed.user}/embed/${embed.id}?default-tab=result&theme-id=dark`}
            width="100%"
            height="360"
            className="border-0 rounded-xl"
            loading="lazy"
            title="CodePen Demo"
          />
        </div>
      );

    case "figma":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(embed.url)}`}
            width="100%"
            height="400"
            className="border-0 rounded-xl"
            allowFullScreen
            loading="lazy"
            title="Figma Prototype"
          />
        </div>
      );

    case "google_maps":
      return (
        <div className="mt-3 w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <iframe
            src={`https://maps.google.com/maps?q=${encodeURIComponent(embed.queryUrl)}&output=embed`}
            width="100%"
            height="280"
            className="border-0 rounded-xl"
            loading="lazy"
            title="Google Maps"
          />
        </div>
      );

    default:
      return null;
  }
}

function FormattedContent({
  content,
  mode,
  className = "",
}: {
  content: string;
  mode?: Mode;
  className?: string;
}) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);
  const mediaEmbeds: MediaEmbedType[] = [];

  const renderedText = parts.map((part, index) => {
    if (part.match(/^https?:\/\//)) {
      const cleanUrl = part.replace(/[),;.]+$/, "");
      const trailingPunctuation = part.slice(cleanUrl.length);
      const embed = parseMediaEmbed(cleanUrl);
      if (embed) {
        const key = JSON.stringify(embed);
        if (!mediaEmbeds.some((e) => JSON.stringify(e) === key)) {
          mediaEmbeds.push(embed);
        }
      }
      return (
        <Fragment key={index}>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-400 hover:text-blue-300 underline break-all inline-flex items-center gap-1 font-sans font-normal"
          >
            {cleanUrl}
          </a>
          {trailingPunctuation}
        </Fragment>
      );
    }
    return <span key={index}>{part}</span>;
  });

  const textStyle = mode
    ? mode === "bubble"
      ? "text-xl sm:text-2xl md:text-3xl tracking-wide font-normal max-w-xl mx-auto text-center"
      : "text-base sm:text-lg md:text-xl text-left tracking-normal max-w-2xl whitespace-pre-wrap font-light mx-auto"
    : "whitespace-pre-wrap";

  return (
    <div className={`w-full ${className}`}>
      <div className={`text-neutral-200 leading-relaxed font-light ${textStyle}`}>
        {renderedText}
      </div>
      {mediaEmbeds.map((embed, idx) => (
        <MediaEmbedItem key={idx} embed={embed} />
      ))}
    </div>
  );
}

type MyListTab = "all" | "bubble" | "will";

interface Echo {
  id: string;
  content: string;
  mode: Mode;
  view_count: number;
  max_views: number;
  resonance_count: number;
  is_reported: boolean;
  is_promoted?: boolean;
  created_at: string;
}

interface MyEchoStatus {
  id: string;
  content: string;
  mode: Mode;
  resonance_count: number;
  remaining_views: number;
  is_deleted: boolean;
  created_at: string; // ISO文字列 (UTC)
}

// LocalStorageから共鳴済みIDセット取得
function getResonatedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const saved = localStorage.getItem("resonated_echoes");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
}

function saveResonatedIds(ids: Set<string>) {
  localStorage.setItem("resonated_echoes", JSON.stringify([...ids]));
}

// LocalStorageから通報済みIDセット取得
function getReportedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const saved = localStorage.getItem("reported_echoes");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
}

function saveReportedIds(ids: Set<string>) {
  localStorage.setItem("reported_echoes", JSON.stringify([...ids]));
}

function HomeContent() {
  const searchParams = useSearchParams();
  const echoIdFromUrl = searchParams.get("echo");
  const [mode, setMode] = useState<DisplayMode>("all");
  const [currentEcho, setCurrentEcho] = useState<Echo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [resonateLoading, setResonateLoading] = useState<boolean>(false);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [fade, setFade] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resonatedIds, setResonatedIds] = useState<Set<string>>(new Set());
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState<boolean>(false);
  const [inputContent, setInputContent] = useState<string>("");
  const [formMode, setFormMode] = useState<Mode>("bubble");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [myEchoes, setMyEchoes] = useState<MyEchoStatus[]>([]);
  const [showMyList, setShowMyList] = useState<boolean>(false);
  const [myListTab, setMyListTab] = useState<MyListTab>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 自分の残響モーダル内の検索・日時フィルター
  const [myKeyword, setMyKeyword] = useState<string>("");
  const [myDateFrom, setMyDateFrom] = useState<string>("");
  const [myDateTo, setMyDateTo] = useState<string>("");

  // 公式お知らせ
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annIndex, setAnnIndex] = useState(0); // 複数ある場合のカルーセル位置
  const [annExpanded, setAnnExpanded] = useState(false); // 展開/折りたたみ

  const maxChars = formMode === "bubble" ? 60 : 800;

  // 指定投稿メイン画面表示
  const viewEchoOnMain = async (echo: MyEchoStatus) => {
    if (echo.is_deleted) return;
    setShowMyList(false);

    setFade(false);
    setErrorMsg(null);
    setTimeout(async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("echoes")
          .select("*")
          .eq("id", echo.id)
          .single();
        if (error || !data) {
          fetchRandomEcho(mode);
          return;
        }
        setMode(data.mode as DisplayMode);
        setCurrentEcho(data as Echo);
        await handleIncrementView(data.id);
      } catch {
        fetchRandomEcho(mode);
      } finally {
        setLoading(false);
        setFade(true);
      }
    }, 300);
  };

  const fetchRandomEcho = async (selectedMode: DisplayMode) => {
    setFade(false);
    setErrorMsg(null);
    setTimeout(async () => {
      try {
        setLoading(true);
        let targetMode: Mode;
        if (selectedMode === "all") {
          targetMode = Math.random() < 0.5 ? "bubble" : "will";
        } else {
          targetMode = selectedMode;
        }

        let { data, error } = await supabase.rpc("get_random_echo", {
          post_mode: targetMode,
        });

        // 選択されたモードで取得できなかった場合のフォールバック（"all"の場合）
        if (!error && (!data || data.length === 0) && selectedMode === "all") {
          const fallbackMode = targetMode === "bubble" ? "will" : "bubble";
          const res = await supabase.rpc("get_random_echo", { post_mode: fallbackMode });
          data = res.data;
          error = res.error;
        }

        if (error) throw error;
        if (data && data.length > 0) {
          const echo = data[0] as Echo;
          setCurrentEcho(echo);
          await handleIncrementView(echo.id);
        } else {
          setCurrentEcho(null);
        }
      } catch (err: unknown) {
        console.error("Error fetching random echo:", err);
        setErrorMsg("データの取得に失敗しました。Supabaseの接続設定（URL・Key）を確認してください。");
      } finally {
        setLoading(false);
        setFade(true);
      }
    }, 300);
  };

  const handleIncrementView = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc("increment_view", { post_id: id });
      if (error) throw error;
      if (data && data.status !== "deleted") {
        setCurrentEcho(prev =>
          prev && prev.id === id ? { ...prev, view_count: data.view_count } : prev
        );
      }
    } catch (err) {
      console.error("Error incrementing view:", err);
    }
  };

  const handleResonate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentEcho || resonateLoading) return;

    const alreadyResonated = resonatedIds.has(currentEcho.id);

    try {
      setResonateLoading(true);

      if (alreadyResonated) {
        const { error } = await supabase
          .from("echoes")
          .update({
            resonance_count: Math.max(0, currentEcho.resonance_count - 1),
            max_views: Math.max(currentEcho.view_count + 1, currentEcho.max_views - 10),
          })
          .eq("id", currentEcho.id);
        if (error) throw error;

        const newIds = new Set(resonatedIds);
        newIds.delete(currentEcho.id);
        setResonatedIds(newIds);
        saveResonatedIds(newIds);

        setCurrentEcho(prev => prev ? {
          ...prev,
          resonance_count: Math.max(0, prev.resonance_count - 1),
          max_views: Math.max(prev.view_count + 1, prev.max_views - 10),
        } : prev);

      } else {
        const { data, error } = await supabase.rpc("resonate_post", { post_id: currentEcho.id });
        if (error) throw error;
        if (data && data.status === "success") {
          const newIds = new Set(resonatedIds);
          newIds.add(currentEcho.id);
          setResonatedIds(newIds);
          saveResonatedIds(newIds);

          setCurrentEcho(prev => prev ? {
            ...prev,
            resonance_count: data.resonance_count,
            max_views: data.max_views,
          } : prev);
        }
      }
    } catch (err: unknown) {
      console.error("Error resonating:", err);
      alert("共鳴処理に失敗しました。");
    } finally {
      setResonateLoading(false);
    }
  };

  const handleReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentEcho || reportLoading) return;

    if (reportedIds.has(currentEcho.id)) {
      alert("この投稿は既に通報済みです。");
      return;
    }

    if (!confirm("この投稿を不適切なコンテンツとして通報しますか？")) return;

    try {
      setReportLoading(true);
      let success = false;

      // 1. まず RPC report_post を試行
      const { data, error: rpcError } = await supabase.rpc("report_post", { post_id: currentEcho.id });

      if (!rpcError && data && data.status === "success") {
        success = true;
      } else {
        // 2. RPCが未適用または失敗した場合は直接 update (report_count + 1) を試行
        const currentReportCount = (currentEcho as any).report_count ?? 0;
        const { error: updateError } = await supabase
          .from("echoes")
          .update({ report_count: currentReportCount + 1 })
          .eq("id", currentEcho.id);

        if (!updateError) {
          success = true;
        } else {
          // 3. カラム未作成等の場合の代替 update (is_reported)
          const { error: fallbackError } = await supabase
            .from("echoes")
            .update({ is_reported: true })
            .eq("id", currentEcho.id);

          if (!fallbackError) {
            success = true;
          } else {
            console.error("RPC Error:", rpcError);
            console.error("Update Error:", updateError);
            console.error("Fallback Error:", fallbackError);
            throw updateError || rpcError || fallbackError;
          }
        }
      }

      if (success) {
        const newIds = new Set(reportedIds);
        newIds.add(currentEcho.id);
        setReportedIds(newIds);
        saveReportedIds(newIds);
        alert("投稿を通報しました。管理者へ報告されます。");
      }
    } catch (err: any) {
      console.error("Error reporting post:", err);
      alert(`通報に失敗しました: ${err?.message || "Supabase DBの設定（supabase.sqlの実行）を確認してください。"}`);
    } finally {
      setReportLoading(false);
    }
  };

  const openForm = () => {
    setInputContent("");
    if (mode === "bubble") {
      setFormMode("bubble");
    } else if (mode === "will") {
      setFormMode("will");
    }
    setShowForm(true);
  };

  const openMyList = () => {
    setMyListTab("all");
    setShowMyList(true);
    fetchMyEchoesStatus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || submitting) return;
    try {
      setSubmitting(true);
      const { data, error } = await supabase
        .from("echoes")
        .insert([{
          content: inputContent.trim(),
          mode: formMode,
          max_views: 100,
        }])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const newEcho = data[0];
        saveMyEcho(newEcho.id, newEcho.content, formMode, newEcho.created_at);
        // 累計投稿数カウンターをインクリメント
        await supabase.rpc("increment_echo_stats");
      }

      setShowForm(false);
      setInputContent("");
      fetchRandomEcho(mode);
    } catch (err: unknown) {
      console.error("Error submitting echo:", err);
      alert("投稿に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const saveMyEcho = (id: string, content: string, itemMode: Mode, createdAt: string) => {
    try {
      const saved = localStorage.getItem("my_echoes");
      const list = saved ? JSON.parse(saved) : [];
      list.push({ id, content, mode: itemMode, created_at: createdAt });
      localStorage.setItem("my_echoes", JSON.stringify(list));
      fetchMyEchoesStatus();
    } catch (err) {
      console.error("Error saving my echo:", err);
    }
  };

  const fetchMyEchoesStatus = async () => {
    try {
      const saved = localStorage.getItem("my_echoes");
      if (!saved) {
        setMyEchoes([]);
        return;
      }
      const list = JSON.parse(saved) as { id: string; content: string; mode?: Mode; created_at?: string }[];
      if (list.length === 0) {
        setMyEchoes([]);
        return;
      }

      const ids = list.map(item => item.id);
      const { data, error } = await supabase
        .from("echoes")
        .select("id, content, mode, view_count, max_views, resonance_count, created_at")
        .in("id", ids);

      if (error) throw error;

      const dbMap = new Map((data || []).map(d => [d.id, d]));

      const statuses: MyEchoStatus[] = list.map(item => {
        const dbItem = dbMap.get(item.id);
        if (dbItem) {
          // DB から取得した created_at を localStorage にも反映（マイグレーション）
          if (!item.created_at) {
            item.created_at = dbItem.created_at;
          }
          return {
            id: item.id,
            content: dbItem.content,
            mode: (dbItem.mode as Mode) || item.mode || "bubble",
            resonance_count: dbItem.resonance_count,
            remaining_views: Math.max(0, dbItem.max_views - dbItem.view_count),
            is_deleted: false,
            created_at: dbItem.created_at,
          };
        } else {
          return {
            id: item.id,
            content: item.content,
            mode: item.mode || "bubble",
            resonance_count: 0,
            remaining_views: 0,
            is_deleted: true,
            created_at: item.created_at ?? "",
          };
        }
      });

      // created_at を localStorage に書き戻す（既存データのマイグレーション）
      const updatedList = list.map(item => {
        const dbItem = dbMap.get(item.id);
        return dbItem ? { ...item, created_at: dbItem.created_at } : item;
      });
      localStorage.setItem("my_echoes", JSON.stringify(updatedList));

      setMyEchoes(statuses.reverse());
    } catch (err) {
      console.error("Error fetching my echoes status:", err);
    }
  };

  const handleDeleteMyEcho = async (id: string, isDeletedFromDb: boolean) => {
    if (!confirm("この投稿をデータベースから完全に消去しますか？")) return;
    if (!isDeletedFromDb) {
      try {
        const { error } = await supabase.from("echoes").delete().eq("id", id);
        if (error) throw error;
      } catch (err: unknown) {
        console.error("Error deleting echo from DB:", err);
      }
    }
    const saved = localStorage.getItem("my_echoes");
    if (saved) {
      const list = JSON.parse(saved) as { id: string; content: string }[];
      localStorage.setItem("my_echoes", JSON.stringify(list.filter(item => item.id !== id)));
    }
    setMyEchoes(prev => prev.filter(echo => echo.id !== id));
    if (currentEcho && currentEcho.id === id) fetchRandomEcho(mode);
  };

  useEffect(() => {
    setResonatedIds(getResonatedIds());
    setReportedIds(getReportedIds());
    fetchMyEchoesStatus();
    // 公式お知らせを取得
    getActiveAnnouncements().then(data => setAnnouncements(data)).catch(() => {});
    if (echoIdFromUrl) {
      // URL に ?echo=<id> がある場合はその投稿を直接取得（閲覧カウントはインクリメントしない）
      (async () => {
        try {
          setLoading(true);
          const { data, error } = await supabase
            .from("echoes")
            .select("*")
            .eq("id", echoIdFromUrl)
            .single();
          if (!error && data) {
            setCurrentEcho(data as Echo);
            setMode(data.mode as DisplayMode);
          } else {
            fetchRandomEcho(mode);
          }
        } catch {
          fetchRandomEcho(mode);
        } finally {
          setLoading(false);
          setFade(true);
        }
      })();
    } else {
      fetchRandomEcho(mode);
    }
  }, []);

  const handleModeChange = (newMode: DisplayMode) => {
    setMode(newMode);
    fetchRandomEcho(newMode);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isResonated = currentEcho ? resonatedIds.has(currentEcho.id) : false;
  const isReported = currentEcho ? reportedIds.has(currentEcho.id) : false;

  // タブ・検索・日時フィルターで絞り込んだリスト
  const filteredMyEchoes = myEchoes.filter(e => {
    if (myListTab !== "all" && e.mode !== myListTab) return false;
    if (myKeyword.trim() && !e.content.toLowerCase().includes(myKeyword.trim().toLowerCase())) return false;
    if (myDateFrom && e.created_at) {
      const from = new Date(`${myDateFrom}T00:00:00+09:00`).getTime();
      if (new Date(e.created_at).getTime() < from) return false;
    }
    if (myDateTo && e.created_at) {
      const to = new Date(`${myDateTo}T23:59:59+09:00`).getTime();
      if (new Date(e.created_at).getTime() > to) return false;
    }
    return true;
  });

  const myBubbles = myEchoes.filter(e => e.mode === "bubble");
  const myWills = myEchoes.filter(e => e.mode === "will");

  const isMyFiltered = myKeyword.trim() !== "" || myDateFrom !== "" || myDateTo !== "";

  const clearMyFilter = () => {
    setMyKeyword("");
    setMyDateFrom("");
    setMyDateTo("");
  };

  return (
    <div
      className="flex flex-col h-dvh max-h-dvh bg-neutral-950 text-neutral-100 font-serif select-none justify-between overflow-hidden relative"
      onClick={() => fetchRandomEcho(mode)}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 sm:w-96 sm:h-96 bg-neutral-900 rounded-full blur-3xl opacity-20 pointer-events-none"></div>

      {/* ヘッダー */}
      <header className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 flex justify-between items-center z-10 shrink-0" onClick={(e) => e.stopPropagation()}>
        <h1 className="text-lg sm:text-xl tracking-[0.2em] font-light text-neutral-300">残響 <span className="text-[10px] sm:text-xs text-neutral-500 font-sans tracking-normal ml-1">Echoes</span></h1>
        <div className="flex bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-full p-0.5 sm:p-1 text-xs sm:text-sm font-sans">
          <button onClick={() => handleModeChange("all")} className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full transition-all duration-300 ${mode === "all" ? "bg-neutral-800 text-neutral-100 shadow-lg" : "text-neutral-500 hover:text-neutral-300"}`}>すべて</button>
          <button onClick={() => handleModeChange("bubble")} className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full transition-all duration-300 ${mode === "bubble" ? "bg-neutral-800 text-neutral-100 shadow-lg" : "text-neutral-500 hover:text-neutral-300"}`}>短文</button>
          <button onClick={() => handleModeChange("will")} className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full transition-all duration-300 ${mode === "will" ? "bg-neutral-800 text-neutral-100 shadow-lg" : "text-neutral-500 hover:text-neutral-300"}`}>長文</button>
        </div>
      </header>

      {/* 公式お知らせバナー */}
      {/* 公式お知らせバナー */}
      {announcements.length > 0 && (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 z-10 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="bg-neutral-900/70 border border-neutral-700/60 rounded-xl backdrop-blur-sm overflow-hidden">

            {/* ヘッダー行（常に表示・タップで展開切り替え） */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
              onClick={() => setAnnExpanded(v => !v)}
            >
              {/* 公式バッジ */}
              <span className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-sans font-medium bg-amber-950/50 border border-amber-700/50 text-amber-400 whitespace-nowrap">
                <Megaphone className="w-3 h-3" />
                公式
              </span>

              {/* タイトル（常に表示、1行で切り捨て） */}
              <span className="flex-1 min-w-0 flex items-center gap-1.5 text-xs font-sans font-medium text-neutral-200 truncate">
                {announcements[annIndex].is_pinned && <Pin className="w-3 h-3 text-amber-400 shrink-0" />}
                <span className="truncate">
                  {announcements[annIndex].title || announcements[annIndex].content}
                </span>
              </span>

              {/* 右端：複数件ナビ ＋ 展開アイコン */}
              <div className="flex items-center gap-1 shrink-0">
                {announcements.length > 1 && !annExpanded && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAnnIndex(i => (i - 1 + announcements.length) % announcements.length); }}
                      className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] text-neutral-600 font-sans tabular-nums">{annIndex + 1}/{announcements.length}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAnnIndex(i => (i + 1) % announcements.length); }}
                      className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 ${annExpanded ? "rotate-180" : ""}`} />
              </div>
            </button>

            {/* 展開時の本文エリア */}
            {annExpanded && (
              <div className="px-4 pb-4 flex flex-col gap-3 border-t border-neutral-800/60 max-h-36 sm:max-h-48 overflow-y-auto scrollbar-thin">
                <FormattedContent
                  content={announcements[annIndex].content}
                  className="text-xs sm:text-sm font-sans text-neutral-300 leading-relaxed pt-3"
                />

                {/* 複数件ある場合のナビゲーション（展開時） */}
                {announcements.length > 1 && (
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800/40">
                    <button
                      onClick={() => setAnnIndex(i => (i - 1 + announcements.length) % announcements.length)}
                      className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors font-sans"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      前のお知らせ
                    </button>
                    <span className="text-[11px] text-neutral-600 font-sans tabular-nums">{annIndex + 1} / {announcements.length}</span>
                    <button
                      onClick={() => setAnnIndex(i => (i + 1) % announcements.length)}
                      className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors font-sans"
                    >
                      次のお知らせ
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* メイン */}
      <main className="flex-1 flex flex-col justify-between items-center px-4 sm:px-6 max-w-3xl mx-auto w-full z-10 cursor-pointer overflow-hidden py-2 min-h-0">
        <div className={`w-full h-full transition-opacity duration-300 flex flex-col items-center justify-between min-h-0 ${fade ? "opacity-100" : "opacity-0"}`}>
          {loading ? (
            <div className="text-neutral-500 text-xs sm:text-sm tracking-widest animate-pulse font-sans my-auto">投稿を取得しています...</div>
          ) : errorMsg ? (
            <div className="text-xs sm:text-sm text-center tracking-wide font-sans max-w-md bg-red-950/20 border border-red-900/30 p-4 rounded-xl text-red-400/80 my-auto">{errorMsg}</div>
          ) : currentEcho ? (
            <div className="w-full flex-1 flex flex-col items-center justify-between min-h-0 overflow-hidden py-1">
              {/* モードタグ（泡沫/遺言） */}
              <div className="mb-2 sm:mb-3 shrink-0 flex items-center justify-center gap-2">
                <span className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-sans border ${currentEcho.mode === "bubble" ? "bg-blue-950/50 text-blue-300 border-blue-900/50" : "bg-purple-950/50 text-purple-300 border-purple-900/50"}`}>
                  {currentEcho.mode === "bubble" ? "泡沫" : "遺言"}
                </span>
                {currentEcho.is_promoted && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-sans bg-amber-950/40 border border-amber-800/50 text-amber-400">
                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                    PR
                  </span>
                )}
              </div>

              {/* コンテンツ本文（URL自動リンク・YouTube埋め込み対応 & フレキシブルスクロール） */}
              <div className="w-full flex-1 overflow-y-auto min-h-0 px-2 py-1 scrollbar-thin flex items-center">
                <FormattedContent
                  content={currentEcho.content}
                  mode={currentEcho.mode}
                  className="my-auto"
                />
              </div>

              <div className="w-full max-w-md mt-3 sm:mt-4 flex flex-col gap-1 sm:gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <div className="w-full h-[2px] bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-neutral-400 transition-all duration-500 ease-out" style={{ width: `${Math.min(100, (currentEcho.view_count / currentEcho.max_views) * 100)}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] sm:text-[11px] text-neutral-500 font-sans tracking-wider">
                  <span>表示: {currentEcho.view_count} / {currentEcho.max_views}</span>
                  <span>（上限で消滅）</span>
                </div>
              </div>

              <div className="mt-2 sm:mt-3 shrink-0 flex items-center justify-center gap-2 sm:gap-3" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={handleResonate}
                  disabled={resonateLoading}
                  className={`group flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 border rounded-full text-[11px] sm:text-xs font-sans tracking-widest transition-all duration-300 active:scale-95 ${
                    isResonated
                      ? "bg-red-950/30 border-red-800/60 text-red-400 hover:bg-red-950/50"
                      : "bg-neutral-900/60 hover:bg-neutral-800/80 border-neutral-800/80 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 transition-transform group-hover:scale-125 ${isResonated ? "fill-red-500 text-red-500" : ""}`} />
                  <span>{isResonated ? `共鳴済み (${currentEcho.resonance_count})` : `共鳴する (${currentEcho.resonance_count})`}</span>
                </button>
                <button
                  onClick={handleReport}
                  disabled={isReported || reportLoading}
                  title={isReported ? "通報済みです" : "不適切な投稿を通報"}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 border rounded-full text-[10px] sm:text-xs font-sans tracking-wider transition-all duration-300 ${
                    isReported
                      ? "bg-neutral-900/40 border-neutral-800/40 text-neutral-600 cursor-not-allowed"
                      : "bg-neutral-900/60 hover:bg-neutral-800/80 border-neutral-800/80 text-neutral-500 hover:text-red-400 hover:border-red-900/50 active:scale-95"
                  }`}
                >
                  <Flag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>{isReported ? "通報済み" : "通報"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-neutral-500 text-xs sm:text-sm tracking-widest font-sans">表示できる投稿がありません。</p>
              <p className="text-neutral-600 text-[11px] sm:text-xs mt-2 tracking-wider font-sans">画面をタップして再読み込みするか、新しく投稿してください。</p>
            </div>
          )}
        </div>
        {currentEcho && !loading && !errorMsg && (
          <div className="mt-1 sm:mt-2 text-[10px] text-neutral-600 font-sans tracking-widest animate-pulse pointer-events-none shrink-0">画面をタップして次の投稿へ</div>
        )}
      </main>

      {/* フッター */}
      <footer className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 flex justify-between items-center z-20 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={openMyList}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors font-sans tracking-wider border-b border-transparent hover:border-neutral-700 pb-0.5"
        >
          自分の残響
        </button>
        <button
          onClick={openForm}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-950 rounded-full text-xs font-sans font-medium hover:bg-neutral-200 transition-all active:scale-95 shadow-md"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>投稿する</span>
        </button>
      </footer>

      {/* 投稿フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-lg bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 sm:p-6 md:p-8 flex flex-col min-h-[340px] max-h-[90dvh] relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300 transition-colors p-1"><X className="w-5 h-5" /></button>
            <h2 className="text-base sm:text-lg tracking-widest text-neutral-300 font-light mb-4 sm:mb-6">思考を残す</h2>
            <div className="flex border-b border-neutral-800 mb-4 sm:mb-6 font-sans">
              <button type="button" onClick={() => setFormMode("bubble")} className={`flex-1 pb-2.5 sm:pb-3 text-xs sm:text-sm transition-all relative ${formMode === "bubble" ? "text-neutral-100 font-medium" : "text-neutral-500"}`}>
                短文 <span className="text-[9px] sm:text-[10px] opacity-70">(最大60文字)</span>
                {formMode === "bubble" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-200"></div>}
              </button>
              <button type="button" onClick={() => setFormMode("will")} className={`flex-1 pb-2.5 sm:pb-3 text-xs sm:text-sm transition-all relative ${formMode === "will" ? "text-neutral-100 font-medium" : "text-neutral-500"}`}>
                長文 <span className="text-[9px] sm:text-[10px] opacity-70">(最大800文字)</span>
                {formMode === "will" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-200"></div>}
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <textarea
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                maxLength={maxChars}
                placeholder={formMode === "bubble" ? "思考を入力..." : "心に残る長文を入力..."}
                required
                className="w-full flex-1 min-h-[120px] bg-transparent text-neutral-200 border-0 outline-none resize-none placeholder-neutral-600 text-sm sm:text-base font-light leading-relaxed mb-4 focus:ring-0 focus:ring-offset-0"
              />
              <div className="flex justify-between items-center mt-auto pt-4 border-t border-neutral-800 shrink-0">
                <span className="text-xs text-neutral-500 font-sans">{inputContent.length} / {maxChars} 文字</span>
                <button type="submit" disabled={submitting || !inputContent.trim()} className="px-5 sm:px-6 py-2 bg-neutral-100 text-neutral-950 hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 rounded-full text-xs font-sans font-medium transition-colors">
                  {submitting ? "送信中..." : "残す"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 自分の残響モーダル */}
      {showMyList && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-lg bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 sm:p-6 md:p-8 flex flex-col max-h-[85dvh] relative">
            <button onClick={() => setShowMyList(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300 transition-colors p-1"><X className="w-5 h-5" /></button>
            <h2 className="text-base sm:text-lg tracking-widest text-neutral-300 font-light mb-4">自分の残響</h2>

            {/* タブ */}
            <div className="flex border-b border-neutral-800 mb-3 font-sans shrink-0">
              {(["all", "bubble", "will"] as const).map(tab => {
                const count = tab === "all" ? myEchoes.length : tab === "bubble" ? myBubbles.length : myWills.length;
                const label = tab === "all" ? "すべて" : tab === "bubble" ? "短文" : "長文";
                return (
                  <button
                    key={tab}
                    onClick={() => setMyListTab(tab)}
                    className={`flex-1 pb-2.5 text-xs sm:text-sm transition-all relative ${myListTab === tab ? "text-neutral-100 font-medium" : "text-neutral-500 hover:text-neutral-300"}`}
                  >
                    {label} <span className="text-[10px] opacity-60">({count})</span>
                    {myListTab === tab && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-200"></div>}
                  </button>
                );
              })}
            </div>

            {/* 検索・日時フィルター */}
            <div className="flex flex-col gap-2 mb-3 shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
                  <input
                    type="text"
                    value={myKeyword}
                    onChange={e => setMyKeyword(e.target.value)}
                    placeholder="テキストで検索..."
                    className="w-full pl-8 pr-3 py-1.5 bg-neutral-800/60 border border-neutral-700 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-neutral-500 transition-colors font-sans"
                  />
                </div>
                {isMyFiltered && (
                  <button
                    onClick={clearMyFilter}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200 rounded-lg text-xs font-sans transition-colors whitespace-nowrap"
                  >
                    <X className="w-3 h-3" />
                    クリア
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 font-sans">
                <span className="text-[10px] text-neutral-500 whitespace-nowrap">投稿日:</span>
                <input
                  type="date"
                  value={myDateFrom}
                  onChange={e => setMyDateFrom(e.target.value)}
                  className="flex-1 px-2 py-1 bg-neutral-800/60 border border-neutral-700 rounded-lg text-xs text-neutral-200 outline-none focus:border-neutral-500 transition-colors [color-scheme:dark]"
                />
                <span className="text-neutral-600 text-xs">〜</span>
                <input
                  type="date"
                  value={myDateTo}
                  onChange={e => setMyDateTo(e.target.value)}
                  className="flex-1 px-2 py-1 bg-neutral-800/60 border border-neutral-700 rounded-lg text-xs text-neutral-200 outline-none focus:border-neutral-500 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            {/* 件数表示 */}
            <p className="text-[10px] text-neutral-500 font-sans mb-2 shrink-0">
              {isMyFiltered
                ? <><span className="text-neutral-400">検索結果:</span> {filteredMyEchoes.length} 件</>
                : <>{filteredMyEchoes.length} 件</>
              }
            </p>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {filteredMyEchoes.length === 0 ? (
                <p className="text-neutral-500 text-xs sm:text-sm tracking-wider text-center py-12 font-sans">
                  {isMyFiltered ? "条件に一致する投稿がありません。" : "まだ投稿がありません。"}
                </p>
              ) : (
                filteredMyEchoes.map((echo) => {
                  const isExpanded = expandedIds.has(echo.id);
                  const isLong = echo.mode === "will";
                  return (
                    <div key={echo.id} className="bg-neutral-950/50 border border-neutral-800/50 rounded-xl overflow-hidden">
                      <div className="p-3 sm:p-4">
                        <div className="mb-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-sans border ${echo.mode === "bubble" ? "bg-blue-950/50 text-blue-300 border-blue-900/50" : "bg-purple-950/50 text-purple-300 border-purple-900/50"}`}>
                            {echo.mode === "bubble" ? "泡沫" : "遺言"}
                          </span>
                        </div>
                        {isLong ? (
                          <>
                            <div className={`text-xs sm:text-sm text-neutral-300 italic font-light leading-relaxed ${!isExpanded ? "line-clamp-3" : ""}`}>
                              <FormattedContent content={echo.content} />
                            </div>
                            <button
                              onClick={() => toggleExpand(echo.id)}
                              className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors font-sans"
                            >
                              {isExpanded ? <><ChevronUp className="w-3 h-3" />折りたたむ</> : <><ChevronDown className="w-3 h-3" />すべて表示</>}
                            </button>
                          </>
                        ) : (
                          <div className="text-xs sm:text-sm text-neutral-300 italic font-light">
                            <FormattedContent content={echo.content} />
                          </div>
                        )}
                      </div>

                      <div className="px-3 sm:px-4 pb-2.5 sm:pb-3 flex items-center justify-between gap-2 border-t border-neutral-900/50 pt-2 font-sans">
                        {echo.is_deleted ? (
                          <span className="text-[10px] text-neutral-600">消滅済み</span>
                        ) : (
                          <span className="text-[10px] text-neutral-500 flex items-center gap-2">
                            <span>残り: <strong className="text-neutral-300">{echo.remaining_views}</strong> 回</span>
                            <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5 text-red-500/70 fill-red-950/20" />{echo.resonance_count}</span>
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {!echo.is_deleted && (
                            <button
                              onClick={() => viewEchoOnMain(echo)}
                              className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] text-neutral-400 hover:text-neutral-100 bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700/50 rounded-full transition-all"
                              title="この内容を表示"
                            >
                              <ExternalLink className="w-3 h-3" />
                              表示
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteMyEcho(echo.id, echo.is_deleted)}
                            className="text-neutral-600 hover:text-red-400 transition-colors p-1"
                            title="削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
