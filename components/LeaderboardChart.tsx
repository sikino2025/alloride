import React from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const data = [
  { name: 'Mon', earnings: 120 },
  { name: 'Tue', earnings: 200 },
  { name: 'Wed', earnings: 150 },
  { name: 'Thu', earnings: 280 },
  { name: 'Fri', earnings: 350 },
  { name: 'Sat', earnings: 400 },
  { name: 'Sun', earnings: 300 },
];

export const LeaderboardChart: React.FC = () => {
  return (
    <div className="h-64 w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-500 mb-4">Weekly Earnings</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#94a3b8' }} 
          />
          <Tooltip 
            cursor={{ fill: '#f1f5f9' }}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="earnings" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 5 ? '#6366f1' : '#cbd5e1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};