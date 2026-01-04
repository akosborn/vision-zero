'use client';

import React, { useState } from 'react';
import Map from './components/map';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faSquareCaretLeft, faSquareCaretRight} from '@fortawesome/free-regular-svg-icons';

export default function Home() {
  const [dateRange, setDateRange] = useState({
    start: '2024-01-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [radiusFeet, setRadiusFeet] = useState(100);
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

          <div className="mb-6">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-slate-400">Location Summary Radius</label>
              <span className="text-xs font-mono text-blue-400">{radiusFeet} ft</span>
            </div>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={radiusFeet}
              onChange={(e) => setRadiusFeet(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold mb-3 text-slate-400 tracking-wider">Severity</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white/20"></span>
                <span className="text-sm text-slate-200">Fatality</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#facc15] border border-white/20"></span>
                <span className="text-sm text-slate-200">Serious Injury</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#22c55e] border border-white/20"></span>
                <span className="text-sm text-slate-200 text-wrap">Minor Injury or Property Damage</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute left-0 top-4 z-20 bg-slate-900 text-white p-2 rounded-r-md shadow-md hover:bg-slate-800 transition-all cursor-pointer"
        style={{ left: isPanelOpen ? '16rem' : '0' }}
      >
        {isPanelOpen ? <FontAwesomeIcon icon={faSquareCaretLeft} /> : <FontAwesomeIcon icon={faSquareCaretRight} />}
      </button>

      {/* Map Area */}
      <div className="flex-1 relative">
        <Map startDate={dateRange.start} endDate={dateRange.end} radiusFeet={radiusFeet} />
      </div>
    </main>
  );
}
