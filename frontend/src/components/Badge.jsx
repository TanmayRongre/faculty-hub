import React from 'react';

/**
 * StatusBadge — colored pill for student/faculty status
 */
export const StatusBadge = ({ status }) => {
  const variants = {
    active:    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    inactive:  'bg-red-500/15 text-red-400 border border-red-500/20',
    graduated: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${variants[status] || variants.inactive}`}>
      {status}
    </span>
  );
};

/**
 * RoleBadge — colored pill for user roles
 */
export const RoleBadge = ({ role }) => {
  const variants = {
    admin:   'bg-purple-500/15 text-purple-400 border border-purple-500/20',
    faculty: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
    student: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${variants[role] || ''}`}>
      {role}
    </span>
  );
};
