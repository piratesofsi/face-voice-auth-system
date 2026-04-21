import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES & CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const mono = "'DM Mono', monospace";
const CYAN = '#00ffe0';
const RED = '#ff2d78';
const BLUE = '#59b3ff';
const CARD_BG = 'rgba(10,10,10,.9)';

// Keep static style objects out of component bodies
const sharedCardStyle = {
  background: CARD_BG,
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 8,
  padding: 20,
  color: '#fff',
};

const sharedTitleStyle = {
  fontFamily: mono,
  fontSize: 9,
  color: 'rgba(255,255,255,.4)',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  marginBottom: 12,
};

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */

export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useSearch(data, searchKeys) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 150);
  
  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return data;
    const q = debouncedQuery.toLowerCase();
    return data.filter(item =>
      searchKeys.some(key => String(item[key] || '').toLowerCase().includes(q))
    );
  }, [data, debouncedQuery, searchKeys]);

  return { query, setQuery, filtered };
}

/* ═══════════════════════════════════════════════════════════════════════════
   UI COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const Badge = ({ label, accent = CYAN }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '4px 10px', borderRadius: 999,
    background: `${accent}22`, color: accent,
    fontFamily: mono, fontSize: 8, letterSpacing: '0.15em', textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }}>
    {label}
  </span>
);
export const MemoizedBadge = React.memo(Badge);

const Button = ({ children, variant = 'primary', disabled, style, ...props }) => {
  const variants = {
    primary: {
      background: 'rgba(0,255,224,.12)',
      border: '1px solid rgba(0,255,224,.25)',
      color: '#00ffe0',
    },
    secondary: {
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.12)',
      color: '#fff',
    },
  };

  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        fontFamily: mono,
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        borderRadius: 4,
        padding: '10px 18px',
        minHeight: 38,
        transition: 'all .2s ease',
        outline: 'none',
        ...variants[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
};
export const MemoizedButton = React.memo(Button);

// Keep old names for backward compatibility
export { MemoizedBadge as Badge, MemoizedButton as Button };

const SectionHeader = ({ title, subtitle, accent }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: '#fff', letterSpacing: '0.12em', marginBottom: 6 }}>
      {title}
    </div>
    {subtitle && (
      <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,.45)', letterSpacing: '0.18em' }}>
        {subtitle}
      </div>
    )}
  </div>
);
export const MemoizedSectionHeader = React.memo(SectionHeader);
export { MemoizedSectionHeader as SectionHeader };

const CardGrid = ({ children, gap = 20 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap }}>
    {children}
  </div>
);
export const MemoizedCardGrid = React.memo(CardGrid);
export { MemoizedCardGrid as CardGrid };

const MetricCard = ({ label, value, accent = CYAN, small }) => (
  <div style={{
    ...sharedCardStyle,
    border: `1px solid ${accent}22`,
    padding: small ? 16 : 20,
    minWidth: 160,
    flex: small ? '0 1 160px' : '1',
  }}>
    <div style={{ ...sharedTitleStyle, marginBottom: 8 }}>{label}</div>
    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: small ? 30 : 42, color: accent, letterSpacing: '0.05em' }}>
      {value}
    </div>
  </div>
);
export const MemoizedMetricCard = React.memo(MetricCard);
export { MemoizedMetricCard as MetricCard };

const ChartCard = ({ title, children, note }) => (
  <div style={{ ...sharedCardStyle, minWidth: 320, flex: 1 }}>
    <div style={sharedTitleStyle}>{title}</div>
    {children}
    {note && (
      <div style={{ marginTop: 16, fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,.35)' }}>
        {note}
      </div>
    )}
  </div>
);
export const MemoizedChartCard = React.memo(ChartCard);
export { MemoizedChartCard as ChartCard };

const EmptyState = ({ title, description }) => (
  <div style={{
    ...sharedCardStyle,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: 180,
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 34, color: 'rgba(255,255,255,.2)', marginBottom: 14 }}>∅</div>
    <div style={{ fontFamily: mono, fontSize: 12, color: '#fff', marginBottom: 8 }}>{title}</div>
    <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,.45)', maxWidth: 380 }}>{description}</div>
  </div>
);
export const MemoizedEmptyState = React.memo(EmptyState);
export { MemoizedEmptyState as EmptyState };

const Search = ({ data, keys, onFiltered, placeholder = 'Search...' }) => {
  const { query, setQuery, filtered } = useSearch(data, keys);

  useEffect(() => {
    onFiltered(filtered);
  }, [filtered, onFiltered]);

  const clearSearch = () => setQuery('');

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 36px 10px 12px',
          background: 'rgba(255,255,255,.03)',
          border: '1px solid rgba(0,255,224,.2)',
          borderRadius: 4,
          color: '#fff',
          fontFamily: mono,
          fontSize: 10,
          outline: 'none',
          transition: 'all .2s',
        }}
      />
      {query && (
        <button
          onClick={clearSearch}
          style={{
            position: 'absolute', top: '50%', right: 10,
            transform: 'translateY(-50%)', border: 'none', background: 'transparent',
            color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 12,
          }}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
};
export const MemoizedSearch = React.memo(Search);
export { MemoizedSearch as Search };

/* ═══════════════════════════════════════════════════════════════════════════
   CHART COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * SuccessRatePie - Displays success vs failed authentication attempts
 * @param {Object} data - { success: number, failed: number }
 */
export function SuccessRatePie({ data }) {
  if (!data) {
    return <EmptyState title="No success data" description="There are no authentication results to display yet." />;
  }

  const chartData = [
    { name: 'Success', value: data.success || 0, fill: CYAN },
    { name: 'Failed', value: data.failed || 0, fill: RED },
  ].filter(d => d.value > 0);

  if (chartData.length === 0) {
    return <EmptyState title="No attempts yet" description="No authentication attempts have been recorded." />;
  }

  return (
    <ChartCard title="Success Rate" note="Shows authenticated vs failed access attempts.">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={chartData} dataKey="value" label />
          <Tooltip 
            contentStyle={{ background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 4 }}
            labelStyle={{ fontFamily: mono, fontSize: 10, color: '#fff' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/**
 * LoginsOverTime - Displays login attempts over 24 hours
 * @param {Array} logs - Array of log objects with logged_at timestamps
 */
export function LoginsOverTime({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return <EmptyState title="No login history" description="Login attempts will appear here once activity starts." />;
  }

  const chartData = useMemo(() => {
    const hourlyData = logs.slice(0, 100).reduce((acc, log) => {
      try {
        const hour = new Date(log.logged_at).toISOString().split('T')[1].slice(0, 13);
        acc[hour] = (acc[hour] || 0) + 1;
      } catch (e) {
        console.warn('Invalid timestamp:', log.logged_at);
      }
      return acc;
    }, {});

    return Object.entries(hourlyData)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .slice(-24);
  }, [logs]);

  if (chartData.length === 0) {
    return <EmptyState title="No recent logs" description="There isn't enough login history for a timeline yet." />;
  }

  return (
    <ChartCard title="Logins (24h)" note="Recent login behavior shown by hour.">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.1)" />
          <XAxis dataKey="hour" stroke="rgba(255,255,255,.4)" />
          <YAxis stroke="rgba(255,255,255,.4)" />
          <Tooltip 
            contentStyle={{ background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 4 }}
            labelStyle={{ fontFamily: mono, fontSize: 10, color: '#fff' }}
          />
          <Line type="monotone" dataKey="count" stroke={CYAN} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export default {
  Badge,
  Button,
  SectionHeader,
  CardGrid,
  MetricCard,
  ChartCard,
  EmptyState,
  Search,
  SuccessRatePie,
  LoginsOverTime,
  useDebouncedValue,
};
