import { useState, useEffect, useCallback } from 'react';
import { getAlerts, dismissAlert } from '../api/alerts';
import './AlertsPage.css';

const TYPE_ICON = { volume: '📊', price: '📈', both: '⚡' };

function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtPrice(p) {
  if (p == null) return '—';
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtVol(v) {
  if (v == null) return '—';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

function AlertCard({ alert, onDismiss }) {
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    setDismissing(true);
    try {
      await onDismiss(alert._id);
    } catch {
      setDismissing(false);
    }
  }

  const type = alert.type || 'volume';

  return (
    <div className={`alert-card alert-card--${type}`}>
      <div className="alert-icon">{TYPE_ICON[type] ?? '🔔'}</div>

      <div className="alert-body">
        <div className="alert-top">
          <span className="alert-ticker">{alert.ticker}</span>
          <span className={`alert-type-badge alert-type-badge--${type}`}>
            {type === 'both' ? 'Vol + Price' : type}
          </span>
          <span className="alert-ts">{fmt(alert.ts)}</span>
        </div>

        <div className="alert-message">{alert.message}</div>

        <div className="alert-stats">
          {alert.price != null && (
            <div className="alert-stat">Price <span>{fmtPrice(alert.price)}</span></div>
          )}
          {alert.volume != null && (
            <div className="alert-stat">Volume <span>{fmtVol(alert.volume)}</span></div>
          )}
          {alert.deviation != null && (
            <div className="alert-stat">Deviation <span>{alert.deviation.toFixed(2)}×</span></div>
          )}
        </div>
      </div>

      <button
        className="alert-dismiss-btn"
        onClick={handleDismiss}
        disabled={dismissing}
      >
        {dismissing ? '…' : 'Dismiss'}
      </button>
    </div>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAlerts(100);
      setAlerts(data.alerts ?? []);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDismiss(id) {
    await dismissAlert(id);
    setAlerts((prev) => prev.filter((a) => String(a._id) !== String(id)));
  }

  return (
    <div className="alerts-page">
      <div className="alerts-header">
        <div>
          <div className="alerts-title">Alerts</div>
          <div className="alerts-subtitle">
            Volume spikes &amp; price moves detected by the market robot
          </div>
        </div>
        <button className="alerts-refresh-btn" onClick={load} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {loading && (
        <div className="alerts-loading">
          <div className="alerts-spinner" />
          Loading alerts…
        </div>
      )}

      {error && !loading && (
        <div className="alerts-error">Failed to load alerts: {error}</div>
      )}

      {!loading && !error && (
        <>
          {alerts.length > 0 && (
            <div className="alerts-count">
              {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
              {lastRefresh && ` · refreshed ${fmt(lastRefresh)}`}
            </div>
          )}

          {alerts.length === 0 ? (
            <div className="alerts-empty">
              <div className="alerts-empty-icon">🤖</div>
              <div className="alerts-empty-title">No active alerts</div>
              <div className="alerts-empty-sub">
                The robot is watching — you'll see alerts here when unusual activity is detected.
              </div>
            </div>
          ) : (
            <div className="alerts-list">
              {alerts.map((a) => (
                <AlertCard key={String(a._id)} alert={a} onDismiss={handleDismiss} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
