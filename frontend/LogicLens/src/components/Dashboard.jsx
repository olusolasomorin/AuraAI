import React, { useState, useEffect } from 'react';
import { Book, Heart, Calendar, Wind, Activity, Brain, ChevronRight, Sparkles } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('journals');
  const [journals, setJournals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const fetchJournals = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem('user')); 
        const userId = storedUser?.user_id || 1; 
        
        if (storedUser?.fullname) {
          setUserName(storedUser.fullname.split(' ')[0]);
        } else {
          setUserName('there');
        }

        const response = await fetch(`https://aura-backend-982983046376.us-west1.run.app/api/journals/${userId}`);
        
        if (response.ok) {
          const data = await response.json();
          setJournals(data);
        } else {
          // 🛠️ NEW: Catch the silent failure!
          console.error("Backend refused to send journals. Status:", response.status);
          alert("Could not load your journals. Please check the console.");
        }
      } catch (error) {
        console.error("Failed to fetch journals", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJournals();
  }, []);

  const copingStrategies = [
    { title: '4-7-8 Breathing', icon: <Wind className="text-blue-400" size={24} />, description: 'Inhale for 4 seconds, hold for 7 seconds, exhale for 8 seconds. Helps calm the nervous system.', category: 'Mindfulness' },
    { title: '5-4-3-2-1 Grounding', icon: <Activity className="text-green-400" size={24} />, description: 'Acknowledge 5 things you see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste. Pulls you back to the present.', category: 'Anxiety Relief' },
    { title: 'Cognitive Reframing', icon: <Brain className="text-purple-400" size={24} />, description: 'Identify negative thought patterns and actively challenge them with objective reality.', category: 'CBT Technique' }
  ];

  return (
    // 🛠️ UPDATED: Responsive padding
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col h-full overflow-y-auto">
      
      {/* Dashboard Header */}
      <div className="mb-6 md:mb-10">
        {/* 🛠️ UPDATED: Responsive text sizing */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          Welcome back, {userName} <Sparkles className="text-purple-400" size={24} />
        </h1>
        <p className="text-sm sm:text-base text-gray-400">Review your emotional journey and access tools to stay grounded.</p>
      </div>

      {/* Tab Navigation */}
      {/* 🛠️ UPDATED: overflow-x-auto allows tabs to scroll horizontally on very narrow phones without breaking UI */}
      <div className="flex space-x-6 border-b border-gray-800 mb-6 md:mb-8 overflow-x-auto scrollbar-hide">
        <button 
          onClick={() => setActiveTab('journals')}
          className={`flex items-center whitespace-nowrap cursor-pointer gap-2 pb-4 px-1 text-base sm:text-lg font-medium transition-colors relative ${
            activeTab === 'journals' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Book size={18} className="sm:w-[20px] sm:h-[20px]" />
          Session Journals
          {activeTab === 'journals' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-500 rounded-t-full"></span>}
        </button>
        <button 
          onClick={() => setActiveTab('strategies')}
          className={`flex items-center whitespace-nowrap cursor-pointer gap-2 pb-4 px-1 text-base sm:text-lg font-medium transition-colors relative ${
            activeTab === 'strategies' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Heart size={18} className="sm:w-[20px] sm:h-[20px]" />
          Coping Strategies
          {activeTab === 'strategies' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-500 rounded-t-full"></span>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        
        {/* JOURNALS TAB */}
        {activeTab === 'journals' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : journals.length === 0 ? (
              <div className="text-center py-16 sm:py-20 px-4 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
                <Book className="mx-auto text-gray-600 mb-4" size={40} />
                <h3 className="text-lg sm:text-xl font-medium text-gray-300 mb-2">No sessions yet</h3>
                <p className="text-sm sm:text-base text-gray-500">Start a session with Aura to log your first journal entry.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {journals.map((journal) => (
                  <div key={journal.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 hover:border-purple-500/50 transition-colors group flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm font-medium">
                        <Calendar size={14} className="sm:w-[16px] sm:h-[16px]" />
                        {journal.date}
                      </div>
                      <span className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border ${
                        journal.mood === 'Calm' || journal.mood === 'Relieved' ? 'bg-green-950/30 text-green-400 border-green-800/50' :
                        journal.mood === 'Anxious' || journal.mood === 'Stressed' ? 'bg-orange-950/30 text-orange-400 border-orange-800/50' :
                        'bg-blue-950/30 text-blue-400 border-blue-800/50'
                      }`}>
                        {journal.mood}
                      </span>
                    </div>
                    <p className="text-sm sm:text-base text-gray-300 leading-relaxed line-clamp-4 flex-1">
                      {journal.summary}
                    </p>
                    <button className="mt-4 sm:mt-6 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-purple-400 font-semibold group-hover:text-purple-300 transition-colors">
                      Read Full Entry <ChevronRight size={14} className="sm:w-[16px] sm:h-[16px]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COPING STRATEGIES TAB */}
        {activeTab === 'strategies' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {copingStrategies.map((strategy, index) => (
                /* 🛠️ UPDATED: Stack icon and text on mobile, put side-by-side on larger screens */
                <div key={index} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start hover:bg-gray-800/50 transition-colors">
                  <div className="p-3 sm:p-4 bg-gray-950 rounded-xl border border-gray-800 shadow-inner shrink-0">
                    {strategy.icon}
                  </div>
                  <div>
                    <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                      {strategy.category}
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{strategy.title}</h3>
                    <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                      {strategy.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* 🛠️ UPDATED: Call to action block flex-col on mobile, flex-row on desktop */}
            <div className="mt-8 sm:mt-10 p-6 sm:p-8 bg-linear-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Need immediate support?</h3>
                <p className="text-sm sm:text-base text-gray-300">Aura is available 24/7 to listen and help you work through your current feelings.</p>
              </div>
              <a 
                href="/session" 
                className="w-full md:w-auto text-center whitespace-nowrap px-8 py-3.5 sm:py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl sm:rounded-full font-bold shadow-lg shadow-purple-600/20 transition-all hover:-translate-y-1"
              >
                Start AI Session
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}