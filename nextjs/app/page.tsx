'use client';

import React, { useState } from 'react';
import Map from './components/map';

export default function Home() {
  const [dateRange, setDateRange] = useState({
    start: '2024-01-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  return (
    <main className="relative flex h-screen w-screen overflow-hidden">
      {/* Sidebar Panel */}
      <div 
        className={`bg-slate-900 text-white transition-all duration-300 ease-in-out z-10 shadow-xl ${
          isPanelOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div className={`p-4 ${isPanelOpen ? 'block' : 'hidden'} whitespace-nowrap`}>
          <h2 className="text-xl font-bold mb-6">Filters</h2>
          
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-400">Start Date</label>
                  <input 
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-400">End Date</label>
                  <input 
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute left-0 top-4 z-20 bg-slate-900 text-white p-2 rounded-r-md shadow-md hover:bg-slate-800 transition-all"
        style={{ left: isPanelOpen ? '16rem' : '0' }}
      >
        {isPanelOpen ? '◀' : '▶'}
      </button>

      {/* Map Area */}
      <div className="flex-1 relative">
        <Map startDate={dateRange.start} endDate={dateRange.end} />
      </div>
    </main>
  );
}
