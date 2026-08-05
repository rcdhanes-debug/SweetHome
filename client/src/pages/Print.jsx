import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { getReport } from '../services/funding';
import Skeleton from '../components/Skeleton';
import { formatCurrency, formatDate, monthKey, monthLabel } from '../utils/format';

export default function Print() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requested = params.get('month') || monthKey();
  const [month, setMonth] = useState(requested);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const autoPrinted = useRef(false);

  const load = async (m) => {
    setReport(null);
    setError('');
    setLoaded(false);
    try {
      setReport(await getReport(m));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    load(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  useEffect(() => {
    if (report && !error && !autoPrinted.current) {
      autoPrinted.current = true;
      const t = setTimeout(() => window.print(), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [report, error]);

  const switchMonth = (e) => {
    const m = e.target.value;
    setMonth(m);
    navigate(`/print?month=${m}`, { replace: true });
  };

  const pastMonths = (() => {
    const now = new Date();
    const list = [];
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(monthKey(d));
    }
    return list;
  })();

  return (
    <div className="page">
      <div className="print-toolbar">
        <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <select className="select print-toolbar__select" value={month} onChange={switchMonth}>
          {pastMonths.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn--primary" onClick={() => window.print()}>
          <Printer size={16} /> Print
        </button>
      </div>

      {!loaded || !report ? (
        <div className="stack">
          <Skeleton height={180} />
          <Skeleton height={260} />
        </div>
      ) : error ? (
        <div className="card">
          <p className="muted">Could not load the report: {error}</p>
        </div>
      ) : (
        <div className="print-doc">
          <header className="print-doc__head">
            <div className="print-doc__brand">Sweet Home</div>
            <div className="print-doc__title">Monthly Dues Report</div>
            <div className="print-doc__sub">{report.monthLabel}</div>
            <div className="print-doc__meta">Generated on {formatDate(report.generatedAt)}</div>
          </header>

          <section className="print-doc__section">
            <h3>Summary</h3>
            <table className="print-table">
              <tbody>
                <tr>
                  <td>Contribution target</td>
                  <td>{formatCurrency(report.targetAmount)}</td>
                </tr>
                <tr>
                  <td>Collected</td>
                  <td>{formatCurrency(report.totalCollected)}</td>
                </tr>
                <tr>
                  <td>Spent</td>
                  <td>{formatCurrency(report.totalSpent)}</td>
                </tr>
                <tr className="print-table__total">
                  <td>Balance</td>
                  <td>{formatCurrency(report.balance)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="print-doc__section">
            <h3>
              Member Settlement ({report.paidCount} / {report.paidCount + report.pendingCount} paid)
            </h3>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Paid on</th>
                </tr>
              </thead>
              <tbody>
                {report.payments.map((p) => (
                  <tr key={p.user?._id || p.user?.name}>
                    <td>{p.user?.name || 'Unknown'}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td>{p.paid ? 'Paid' : 'Pending'}</td>
                    <td>{p.paid ? formatDate(p.paidAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="print-doc__section">
            <h3>Spending by Category</h3>
            {report.categories.length === 0 ? (
              <p className="muted">No expenses recorded for this month.</p>
            ) : (
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Entries</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.categories.map((c) => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td>{c.count}</td>
                      <td>{formatCurrency(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="print-doc__section">
            <h3>Expense Details</h3>
            {report.expenses.length === 0 ? (
              <p className="muted">No expenses recorded for this month.</p>
            ) : (
              <table className="print-table print-table--full">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Paid by</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.expenses.map((e) => (
                    <tr key={e._id}>
                      <td>{formatDate(e.expenseDate)}</td>
                      <td>{e.category}</td>
                      <td>{e.description}</td>
                      <td>{e.paidBy}</td>
                      <td>{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <footer className="print-doc__foot">
            Deadline for contributions: 5th of the month. Balance carries over for household use.
          </footer>
        </div>
      )}
    </div>
  );
}
