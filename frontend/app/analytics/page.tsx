"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Lock, Crown, BarChart3, Clock, Zap } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";

type OverviewData = {
  total_prompts: number;
  average_quality_score: number;
  current_streak_days: number;
};

type MostUsedData = {
  name: string;
  usage_count: number;
};

type TrendData = {
  date: string;
  average_score: number;
};

type ReportCardData = {
  narrative: string;
  score_delta: string;
  most_improved_category: string;
  streak: number;
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [mostUsed, setMostUsed] = useState<MostUsedData[]>([]);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [reportCard, setReportCard] = useState<ReportCardData | null>(null);
  const [trendRange, setTrendRange] = useState(30);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchData();
  }, [user, authLoading, trendRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const overviewRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/overview`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("auth_token")}` }
      });
      
      if (overviewRes.status === 403) {
        setIsPro(false);
        setLoading(false);
        return;
      }
      
      setIsPro(true);
      const overviewData = await overviewRes.json();
      setOverview(overviewData);

      const [mostUsedRes, trendRes, reportCardRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/most-used`, { headers: { "Authorization": `Bearer ${localStorage.getItem("auth_token")}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/quality-trend?range=${trendRange}`, { headers: { "Authorization": `Bearer ${localStorage.getItem("auth_token")}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/report-card`, { headers: { "Authorization": `Bearer ${localStorage.getItem("auth_token")}` } })
      ]);

      const mostUsedData = await mostUsedRes.json();
      const trendData = await trendRes.json();
      
      setMostUsed(mostUsedData.prompts || []);
      setTrend(trendData.trend || []);
      setReportCard(await reportCardRes.json());
      
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    }
    setLoading(false);
  };

  const handleTogglePro = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/toggle-pro`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("auth_token")}` }
      });
      fetchData();
    } catch (error) {
      console.error("Error toggling pro:", error);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center font-semibold text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen relative overflow-hidden pb-20">
      {/* Animated Wave Background */}
      <div className="bg-wave-container">
        <svg className="waves" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
          <defs>
            <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
          </defs>
          <g className="parallax">
            <use xlinkHref="#gentle-wave" x="48" y="0" />
            <use xlinkHref="#gentle-wave" x="48" y="3" />
            <use xlinkHref="#gentle-wave" x="48" y="5" />
            <use xlinkHref="#gentle-wave" x="48" y="7" />
          </g>
        </svg>
      </div>

      {/* Navbar Minimal */}
      <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/generator")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <BarChart3 className="text-[#D4AF37]" size={24} />
              <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                Usage Analytics
              </h1>
              <span className="px-2 py-0.5 bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                PRO
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 relative z-10">
        
        {loading ? (
          <div className="flex justify-center items-center h-64 text-gray-500 font-medium">Loading your analytics...</div>
        ) : isPro === false ? (
          /* LOCKED STATE */
          <div className="relative">
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[6px] z-10 flex flex-col items-center justify-center rounded-3xl border border-white/50">
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-[#D4AF37]/20 text-center max-w-md w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB]"></div>
                <Crown size={48} className="mx-auto text-[#D4AF37] mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Unlock Usage Analytics</h2>
                <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                  See which prompts you use most, track your average quality scores over time, and get a personalized report card on how your prompt writing has improved.
                </p>
                <button 
                  onClick={handleTogglePro}
                  className="w-full py-3.5 bg-gradient-to-r from-black to-gray-800 text-[#D4AF37] rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <Lock size={16} />
                  Unlock Pro (Test)
                </button>
              </div>
            </div>

            {/* FAKE BLURRED BACKGROUND */}
            <div className="opacity-30 pointer-events-none select-none blur-sm filter grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 h-32"></div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 h-32"></div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 h-32"></div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 md:col-span-2 h-80"></div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 h-80"></div>
            </div>
          </div>
        ) : (
          /* UNLOCKED STATE */
          <div className="space-y-6">
            
            {/* Report Card */}
            {reportCard && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-[#ffffff] to-[#faf9f0] p-6 rounded-3xl border border-[#D4AF37]/30 shadow-sm relative overflow-hidden"
              >
                <div className="absolute -right-10 -top-10 opacity-10">
                  <Crown size={180} className="text-[#D4AF37]" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center md:items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Zap size={16} />
                      Your Improvement Report Card
                    </h2>
                    <p className="text-gray-800 text-lg md:text-xl font-medium leading-relaxed">
                      "{reportCard.narrative || "Keep generating prompts to receive your personalized insights!"}"
                    </p>
                  </div>
                  <div className="flex gap-4 shrink-0 bg-white/50 p-4 rounded-2xl border border-[#D4AF37]/20">
                    <div className="text-center px-4">
                      <div className="text-2xl font-black text-gray-900">{reportCard.score_delta || "0.0"}</div>
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-1">Score Delta</div>
                    </div>
                    <div className="w-px bg-[#D4AF37]/20"></div>
                    <div className="text-center px-4">
                      <div className="text-2xl font-black text-gray-900">{reportCard.streak ?? 0} <span className="text-sm text-gray-400">days</span></div>
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-1">Consistency</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Overview Stats */}
            {overview && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Total Prompts</div>
                    <div className="text-4xl font-black text-gray-900">{overview.total_prompts ?? 0}</div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
                    <BarChart3 size={24} />
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Avg Quality Score</div>
                    <div className="text-4xl font-black text-gray-900">{overview.average_quality_score ?? 0}<span className="text-lg text-gray-400 font-medium">/100</span></div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-500">
                    <TrendingUp size={24} />
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Current Streak</div>
                    <div className="text-4xl font-black text-gray-900">{overview.current_streak_days ?? 0} <span className="text-lg text-gray-400 font-medium">days</span></div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500">
                    <Clock size={24} />
                  </div>
                </div>
              </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Quality Trend */}
              <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm lg:col-span-2 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-gray-900">Quality Score Trend</h3>
                  <select 
                    value={trendRange} 
                    onChange={(e) => setTrendRange(Number(e.target.value))}
                    className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl px-3 py-1.5 font-medium outline-none cursor-pointer"
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                  </select>
                </div>
                <div className="flex-1 w-full h-[300px]">
                  {trend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{fontSize: 12, fill: '#9ca3af'}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                          itemStyle={{ color: '#111827', fontWeight: 600 }}
                        />
                        <Line type="monotone" dataKey="average_score" name="Avg Score" stroke="#D4AF37" strokeWidth={3} dot={{r: 4, fill: '#D4AF37', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-medium">Not enough data to display trend.</div>
                  )}
                </div>
              </div>

              {/* Most Used Categories */}
              <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold text-gray-900 mb-8">Most-Used Categories</h3>
                <div className="flex-1 w-full h-[300px]">
                  {mostUsed?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mostUsed} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" hide allowDecimals={false} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#4b5563', fontWeight: 500}} width={120} />
                        <RechartsTooltip 
                          cursor={{fill: '#f9fafb'}}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                        />
                        <Bar dataKey="usage_count" name="Generations" radius={[0, 6, 6, 0]} barSize={32}>
                          {
                            mostUsed.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#D4AF37' : '#e5e7eb'} />
                            ))
                          }
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-medium">No usage data yet.</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      <style>{`
        .bg-wave-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; background: #F3F3F3; overflow: hidden; }
        .waves { position: absolute; bottom: 0; width: 100%; height: 100vh; min-height: 100vh; }
        .parallax > use { animation: move-forever 25s cubic-bezier(.55,.5,.45,.5) infinite; }
        .parallax > use:nth-child(1) { animation-delay: -2s; animation-duration: 7s; fill: rgba(244, 206, 20, 0.4); }
        .parallax > use:nth-child(2) { animation-delay: -3s; animation-duration: 10s; fill: rgba(244, 206, 20, 0.3); }
        .parallax > use:nth-child(3) { animation-delay: -4s; animation-duration: 13s; fill: rgba(244, 206, 20, 0.2); }
        .parallax > use:nth-child(4) { animation-delay: -5s; animation-duration: 20s; fill: #F3F3F3; }
        @keyframes move-forever { 0% { transform: translate3d(-90px,0,0); } 100% { transform: translate3d(85px,0,0); } }
      `}</style>
    </div>
  );
}
