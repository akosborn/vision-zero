'use client';

import React, { useState } from 'react';
import Map from './components/map';

export default function Home() {
  const [selectedYear, setSelectedYear] = useState(2025);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const years = [2025, 2024, 2023, 2022, 2021];

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
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-slate-400">Occurrence Year</label>
            <div className="space-y-2">
              {years.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`w-full text-left px-3 py-2 rounded transition-colors ${
                    selectedYear === year 
                      ? 'bg-blue-600 text-white' 
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  {year}
                </button>
              ))}
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
        <Map selectedYear={selectedYear} />
      </div>
    </main>
  );
}
