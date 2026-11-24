import React from 'react';
import { NavLink } from 'react-router-dom';
import { Heart, Flame, Users, User } from 'lucide-react';
import { hapticFeedback } from '../../services/haptics';

export const FloatingBottomNav: React.FC = () => {
  const navItems = [
    { label: 'Health', to: '/', icon: Heart },
    { label: 'Workouts', to: '/workouts', icon: Flame },
    { label: 'Community', to: '/community', icon: Users },
    { label: 'My page', to: '/my-page', icon: User },
  ];

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto">
      <div className="floating-nav rounded-full px-6 py-3 flex items-center justify-between shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => hapticFeedback.light()}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 transition-all duration-200 relative px-3 py-1 active:scale-95 ${
                  isActive ? 'text-[#6bfb9a]' : 'text-[#869486] hover:text-[#bccabb]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'text-white font-semibold' : ''}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#6bfb9a] shadow-[0_0_8px_#6bfb9a]" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
