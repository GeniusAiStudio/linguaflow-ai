import React, { useState } from 'react';
import { Download, Search, Loader2, Play, Heart, ArrowLeft } from 'lucide-react';

interface TikTokData {
  title: string;
  cover: string;
  play: string;
  author: {
    nickname: string;
    avatar: string;
  };
  play_count: number;
  digg_count: number;
}

interface TikTokDownloaderProps {
  onBack: () => void;
}

export const TikTokDownloader: React.FC<TikTokDownloaderProps> = ({ onBack }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoData, setVideoData] = useState<TikTokData | null>(null);
  const [downloading, setDownloading] = useState(false);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const handleFetch = async () => {
    if (!url.trim()) {
      setError('Please enter a valid TikTok URL');
      return;
    }

    setLoading(true);
    setError('');
    setVideoData(null);

    try {
      // Using tikwm API as requested
      const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (data.code === 0 && data.data) {
        setVideoData(data.data);
      } else {
        setError(data.msg || 'Failed to fetch video details. Please check the URL.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while fetching the video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!videoData?.play) return;
    
    setDownloading(true);
    try {
      // Create an invisible anchor tag to trigger download
      const a = document.createElement('a');
      a.href = videoData.play;
      a.target = '_blank';
      a.download = `tiktok_video_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Download failed. The URL might be restricted. Opening in new tab instead.");
      window.open(videoData.play, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-3 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-2xl transition-all"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">TikTok Downloader</h2>
          <p className="text-slate-400 mt-1">Download TikTok videos without watermark instantly</p>
        </div>
      </div>

      <div className="p-8 bg-[#1e2330] rounded-[2rem] border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-slate-500" />
            </div>
            <input
              type="text"
              className="block w-full pl-14 pr-6 py-5 bg-[#141824] border border-slate-700 rounded-2xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#4D45E5] focus:ring-1 focus:ring-[#4D45E5] transition-all text-lg"
              placeholder="Paste TikTok video link here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
            />
          </div>
          <button
            onClick={handleFetch}
            disabled={loading}
            className="px-10 py-5 bg-[#4D45E5] text-white font-bold rounded-2xl hover:bg-[#3b35c6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px] text-lg shadow-lg shadow-indigo-500/20"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              'Get Video'
            )}
          </button>
        </div>

        {error && (
          <div className="mb-8 p-5 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 text-sm font-medium">
            {error}
          </div>
        )}

        {videoData && (
          <div className="bg-[#141824] rounded-3xl p-6 border border-slate-700/50 flex flex-col md:flex-row gap-8 items-start animate-in fade-in slide-in-from-bottom-4">
            <div className="w-full md:w-[240px] aspect-[9/16] relative rounded-2xl overflow-hidden shadow-2xl bg-black shrink-0 border border-slate-800">
              <img 
                src={videoData.cover} 
                alt="Video cover" 
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-md shadow-xl border border-white/10">
                  <Play className="w-6 h-6 text-white ml-1" />
                </div>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col w-full h-full justify-between py-2">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <img 
                    src={videoData.author.avatar} 
                    alt={videoData.author.nickname}
                    className="w-14 h-14 rounded-full border-2 border-slate-700 shadow-md"
                  />
                  <div>
                    <h3 className="font-bold text-lg text-slate-200">{videoData.author.nickname}</h3>
                    <p className="text-sm text-slate-500 font-medium">TikTok Creator</p>
                  </div>
                </div>
                
                <p className="text-slate-300 text-lg mb-8 leading-relaxed line-clamp-4">
                  {videoData.title}
                </p>
                
                <div className="flex items-center gap-8 mb-10">
                  <div className="flex items-center gap-3 text-slate-400 bg-slate-800/50 px-4 py-2 rounded-xl">
                    <Play className="w-5 h-5 text-indigo-400" />
                    <span className="font-bold">{formatNumber(videoData.play_count)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 bg-slate-800/50 px-4 py-2 rounded-xl">
                    <Heart className="w-5 h-5 text-rose-400" />
                    <span className="font-bold">{formatNumber(videoData.digg_count)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full py-5 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 text-lg shadow-lg shadow-emerald-500/20"
              >
                {downloading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Download className="w-6 h-6" />
                    Download No Watermark
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default TikTokDownloader;
