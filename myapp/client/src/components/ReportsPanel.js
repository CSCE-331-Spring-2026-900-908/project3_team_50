import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './ReportsPanel.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function defaultEndDate() {
  return new Date().toISOString().slice(0, 10);
}

function defaultStartDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function formatReportText(title, data) {
  if (!data) return '';
  let out = `${title}\n${'='.repeat(60)}\n\n`;
  if (data.summary) {
    const s = data.summary;
    out += `Total Orders: ${s.order_count ?? '—'}\n`;
    out += `Total Revenue: $${Number(s.total_revenue || 0).toFixed(2)}\n`;
    if (s.order_count > 0) {
      out += `Average Order Value: $${(Number(s.total_revenue) / s.order_count).toFixed(2)}\n`;
    }
    out += '\nBreakdown Over Time:\n';
    out += `${'Date'.padEnd(12)} ${'Hour'.padEnd(8)} ${'Orders'.padEnd(8)} Revenue\n`;
    out += '-'.repeat(50) + '\n';
    (data.hourly || []).forEach((row) => {
      const dateStr = row.date ? String(row.date).slice(0, 10) : '';
      const h = row.hour != null ? `${row.hour}:00` : '';
      out += `${dateStr.padEnd(12)} ${h.padEnd(8)} ${String(row.orders).padEnd(8)} $${Number(row.revenue || 0).toFixed(2)}\n`;
    });
    return out;
  }
  if (data.totals && data.hourly) {
    const t = data.totals;
    out = `${data.title || 'Report'}\n`;
    out += `Since: ${data.since ? new Date(data.since).toLocaleString() : '—'}\n`;
    out += `${'='.repeat(60)}\n\n`;
    out += `Total Orders: ${t.orders ?? '—'}\n`;
    out += `Total Sales (incl. tax): $${Number(t.total_sales || 0).toFixed(2)}\n`;
    out += `Total Tax: $${Number(t.total_tax || 0).toFixed(2)}\n`;
    out += `Cash Sales: $${Number(t.cash_sales || 0).toFixed(2)}\n`;
    out += `Card Sales: $${Number(t.card_sales || 0).toFixed(2)}\n\n`;
    out += `Sales Per Hour:\n${'Hour'.padEnd(10)} ${'Orders'.padEnd(10)} Sales\n`;
    out += '-'.repeat(36) + '\n';
    (data.hourly || []).forEach((row) => {
      const label = row.hour != null ? `${row.hour}:00` : '';
      out += `${label.padEnd(10)} ${String(row.orders).padEnd(10)} $${Number(row.sales || 0).toFixed(2)}\n`;
    });
    return out;
  }
  if (Array.isArray(data.rows)) {
    if (data.rows.length === 0) {
      return `${title}\n(No rows)\n`;
    }
    const keys = Object.keys(data.rows[0]);
    out += keys.join('\t') + '\n';
    out += '-'.repeat(60) + '\n';
    data.rows.forEach((row) => {
      out += keys.map((k) => String(row[k] ?? '')).join('\t') + '\n';
    });
  }
  return out;
}

function BarChart({ rows, labelKey, valueKey, labelFormat }) {
  if (!rows || rows.length === 0) return <p className="reports-chart-empty">No chart data.</p>;
  const vals = rows.map((r) => Math.abs(Number(r[valueKey]) || 0));
  const max = Math.max(...vals, 1);
  return (
    <div className="reports-bar-chart">
      {rows.map((row, i) => {
        let label = row[labelKey];
        if (labelFormat === 'hour' && row.hour != null) label = `${row.hour}:00`;
        const v = Number(row[valueKey]) || 0;
        const pct = (v / max) * 100;
        return (
          <div key={i} className="reports-bar-row">
            <span className="reports-bar-label">{String(label)}</span>
            <div className="reports-bar-track">
              <div className="reports-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="reports-bar-value">{typeof v === 'number' ? v.toFixed(2) : v}</span>
          </div>
        );
      })}
    </div>
  );
}

function PieLegend({ rows, labelKey, valueKey }) {
  if (!rows || rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + Math.abs(Number(r[valueKey]) || 0), 0) || 1;
  return (
    <ul className="reports-pie-legend">
      {rows.map((row, i) => {
        const v = Number(row[valueKey]) || 0;
        const pct = (v / total) * 100;
        return (
          <li key={i}>
            <span className="reports-pie-name">{row[labelKey]}</span>
            <span className="reports-pie-pct">{pct.toFixed(1)}%</span>
            <span className="reports-pie-val">${v.toFixed(2)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ReportsPanel() {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportTitle, setReportTitle] = useState('Daily Reports');
  const [reportText, setReportText] = useState('Select a report below.');
  const [chartData, setChartData] = useState(null);
  const [activeReport, setActiveReport] = useState('sales-category');
  const loadedDefaultReport = useRef(false);

  const [showCustom, setShowCustom] = useState(false);
  const [customQueries, setCustomQueries] = useState([]);
  const [newName, setNewName] = useState('');
  const [newSql, setNewSql] = useState('');

  const dateParams = useCallback(
    () => ({ params: { start: startDate || undefined, end: endDate || undefined } }),
    [startDate, endDate]
  );

  const loadCustomQueries = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/reports/custom-queries`);
      setCustomQueries(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadCustomQueries();
  }, [loadCustomQueries]);

  const runReport = useCallback(async (type) => {
    setLoading(true);
    setError('');
    setChartData(null);
    setActiveReport(type);
    try {
      let res;
      switch (type) {
        case 'sales-category':
          res = await axios.get(`${API}/reports/sales-by-category`, dateParams());
          break;
        case 'top-selling':
          res = await axios.get(`${API}/reports/top-selling`, dateParams());
          break;
        case 'low-stock':
          res = await axios.get(`${API}/reports/low-stock`);
          break;
        case 'revenue':
          res = await axios.get(`${API}/reports/revenue`, dateParams());
          break;
        case 'employee':
          res = await axios.get(`${API}/reports/employee-summary`, dateParams());
          break;
        case 'usage':
          res = await axios.get(`${API}/reports/product-usage`, dateParams());
          break;
        case 'x-report':
          res = await axios.get(`${API}/reports/x-report`);
          break;
        case 'z-report':
          res = await axios.post(`${API}/reports/z-report`);
          break;
        default:
          return;
      }
      const data = res.data;
      if (data.alreadyLogged) {
        setReportTitle('Z-Report');
        setReportText(
          `Z-Report already generated for today.\n${JSON.stringify(data.row, null, 2)}`
        );
        setChartData(null);
        return;
      }
      setReportTitle(data.title || type);
      setReportText(formatReportText(data.title || '', data));
      if (data.chart && data.rows) {
        setChartData({ ...data.chart, rows: data.rows });
      } else if (data.chart && data.hourly) {
        setChartData({ ...data.chart, rows: data.hourly });
      } else {
        setChartData(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setReportText('');
    } finally {
      setLoading(false);
    }
  }, [dateParams]);

  useEffect(() => {
    if (loadedDefaultReport.current) return;
    loadedDefaultReport.current = true;
    runReport('sales-category');
  }, [runReport]);

  const runCustomQuery = async (id) => {
    setLoading(true);
    setError('');
    setActiveReport(`custom-${id}`);
    try {
      const res = await axios.get(`${API}/reports/custom-queries/${id}/run`);
      const { columns, rows } = res.data;
      setReportTitle('Custom Query');
      let text = columns.join('\t') + '\n';
      rows.forEach((row) => {
        text += columns.map((c) => String(row[c] ?? '')).join('\t') + '\n';
      });
      setReportText(text);
      setChartData(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const reportButtonClass = (type, extra = '') =>
    ['action-btn', extra, activeReport === type ? 'reports-active' : '']
      .filter(Boolean)
      .join(' ');

  const saveCustomQuery = async () => {
    if (!newName.trim() || !newSql.trim()) return;
    try {
      await axios.post(`${API}/reports/custom-queries`, {
        query_name: newName.trim(),
        query_sql: newSql.trim(),
      });
      setNewName('');
      setNewSql('');
      loadCustomQueries();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const deleteCustomQuery = async (id) => {
    if (!window.confirm('Delete this custom query?')) return;
    try {
      await axios.delete(`${API}/reports/custom-queries/${id}`);
      loadCustomQueries();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="reports-panel">
      <div className="mgmt-header reports-header">
        <h1>Daily Reports</h1>
        <Link className="action-btn back-link-btn" to="/manager-dashboard">
          ← Back to Dashboard
        </Link>
      </div>

      {error && <div className="toast toast-error">{error}</div>}

      <div className="reports-filters glass-card">
        <label>
          Start date
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          End date
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <span className="reports-filter-hint">Used for date-ranged reports (not X/Z / low stock).</span>
      </div>

      <div className="reports-layout">
        {showCustom && (
          <aside className="reports-custom-sidebar glass-card">
            <h3>Custom Queries</h3>
            <ul className="reports-custom-list">
              {customQueries.map((q) => (
                <li key={q.query_id}>
                  <button type="button" className="reports-custom-run" onClick={() => runCustomQuery(q.query_id)}>
                    {q.query_name}
                  </button>
                  <button
                    type="button"
                    className="reports-custom-del"
                    onClick={() => deleteCustomQuery(q.query_id)}
                    aria-label="Delete"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="reports-custom-add">
              <input
                type="text"
                placeholder="Query name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <textarea
                placeholder="SELECT ..."
                rows={4}
                value={newSql}
                onChange={(e) => setNewSql(e.target.value)}
              />
              <button type="button" className="action-btn add" onClick={saveCustomQuery}>
                Save query
              </button>
            </div>
          </aside>
        )}

        <div className="reports-main">
          <div className="reports-buttons">
            <button type="button" className={reportButtonClass('sales-category')} disabled={loading} onClick={() => runReport('sales-category')}>
              Sales by Category
            </button>
            <button type="button" className={reportButtonClass('top-selling')} disabled={loading} onClick={() => runReport('top-selling')}>
              Top Selling Items
            </button>
            <button type="button" className={reportButtonClass('low-stock')} disabled={loading} onClick={() => runReport('low-stock')}>
              Low Stock
            </button>
            <button type="button" className={reportButtonClass('revenue')} disabled={loading} onClick={() => runReport('revenue')}>
              Revenue
            </button>
            <button type="button" className={reportButtonClass('employee')} disabled={loading} onClick={() => runReport('employee')}>
              Employee Summary
            </button>
            <button type="button" className={reportButtonClass('usage')} disabled={loading} onClick={() => runReport('usage')}>
              Product Usage
            </button>
            <button type="button" className={reportButtonClass('x-report')} disabled={loading} onClick={() => runReport('x-report')}>
              X-Report
            </button>
            <button type="button" className={reportButtonClass('z-report', 'delete')} disabled={loading} onClick={() => runReport('z-report')}>
              Z-Report (close day)
            </button>
            <button type="button" className="action-btn add" onClick={() => setShowCustom((s) => !s)}>
              {showCustom ? 'Hide' : 'Show'} Custom Queries
            </button>
          </div>

          <div className="reports-center glass-card">
            <h2 className="reports-chart-title">{reportTitle}</h2>
            {loading && <p className="reports-loading">Loading…</p>}
            <div className="reports-chart-wrap">
              {chartData && chartData.type === 'bar' && (
                <BarChart
                  rows={chartData.rows}
                  labelKey={chartData.labelKey}
                  valueKey={chartData.valueKey}
                  labelFormat={chartData.labelFormat}
                />
              )}
              {chartData && chartData.type === 'pie' && (
                <PieLegend rows={chartData.rows} labelKey={chartData.labelKey} valueKey={chartData.valueKey} />
              )}
            </div>
            <pre className="reports-text-area">{reportText}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
