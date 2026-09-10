import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiUserPlus, FiSearch, FiDownload, FiEye, FiPower } from 'react-icons/fi';
import { employeeAPI, sectionAPI, flowAPI, shiftAPI, dashboardAPI } from '../../api';
import { Panel, StatusBadge, Avatar, Loading, ErrorState, EmptyState, exportCsv, formatTime, EmployeeCell, KpiCard, minutesToLabel } from '../../components/ui';
import { EmployeeTimelineModal } from '../../components/EmployeeTimelineModal';
import { useAuthStore } from '../../store/authStore';

export default function EmployeesPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sectionId, setSectionId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [timelineEmp, setTimelineEmp] = useState<any>(null);
  const canCreate = ['SUPER_ADMIN', 'MAIN_ADMIN'].includes(user?.role || '');

  const empsQ = useQuery({
    queryKey: ['employees', search, page, sectionId],
    queryFn: () => employeeAPI.getAll({ search, page, limit: 15, sectionId: sectionId || undefined }),
  });
  const gridQ = useQuery({ queryKey: ['dash-employees-lite'], queryFn: () => dashboardAPI.employees({ limit: 200 }), staleTime: 60_000 });
  const sectionsQ = useQuery({ queryKey: ['sections'], queryFn: sectionAPI.getAll, staleTime: 300_000 });

  const data = empsQ.data?.data;
  const states: any[] = gridQ.data?.data?.cards || [];
  const stateMap = new Map(states.map((c: any) => [c.employee._id, c]));

  const toggleStatus = async (id: string) => {
    await employeeAPI.toggleStatus(id);
    qc.invalidateQueries({ queryKey: ['employees'] });
    qc.invalidateQueries({ queryKey: ['dash-employees-lite'] });
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid grid-kpi">
        <KpiCard label="Headcount (page filter)" value={data?.total ?? 0} tone="blue" />
        <KpiCard label="Present Now" value={states.filter((s: any) => ['PRESENT', 'LATE'].includes(s.state)).length} tone="green" />
        <KpiCard label="On Break" value={states.filter((s: any) => ['ON_LUNCH', 'ON_TEA'].includes(s.state)).length} tone="cyan" />
        <KpiCard label="Absent" value={states.filter((s: any) => s.state === 'ABSENT').length} tone="red" />
      </div>

      <Panel
        title="Employee Management"
        actions={
          <div className="row wrap" style={{ gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <FiSearch size={13} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-low)' }} />
              <input className="input" placeholder="Name / ID / email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 28, width: 210 }} />
            </div>
            <select className="select" style={{ width: 170 }} value={sectionId} onChange={(e) => { setSectionId(e.target.value); setPage(1); }}>
              <option value="">All sections</option>
              {(sectionsQ.data?.data || []).map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            {canCreate && <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}><FiUserPlus size={12} /> ADD EMPLOYEE</button>}
            <button className="btn btn-sm" onClick={() => exportCsv('employees.csv', (data?.employees || []).map((e: any) => ({
              employeeId: e.employeeId, name: e.fullName, email: e.email, phone: e.phone, department: e.department,
              section: e.sectionId?.name, flow: e.flowId?.name, shift: e.shiftId?.name, status: e.employmentStatus,
            })))}>
              <FiDownload size={11} /> CSV
            </button>
          </div>
        }
        bodyClass=""
      >
        {empsQ.isLoading ? (
          <Loading label="Loading personnel files…" />
        ) : empsQ.isError ? (
          <ErrorState message={String(empsQ.error)} onRetry={() => empsQ.refetch()} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Employee</th><th>Section</th><th>Flow</th><th>Shift</th><th>Status</th><th>Attendance</th><th>Last Event</th><th>GPS</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {(data?.employees || []).map((e: any) => {
                    const st = stateMap.get(e._id);
                    return (
                      <tr key={e._id}>
                        <td><EmployeeCell photo={e.photo} name={e.fullName} code={e.employeeId} sub={<span className="micro">{e.department}</span>} /></td>
                        <td className="fs-12">{e.sectionId?.name}</td>
                        <td className="fs-12">{e.flowId?.name}</td>
                        <td className="fs-12 text-mid">{e.shiftId?.name}</td>
                        <td><StatusBadge value={e.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                        <td>{st ? <StatusBadge value={st.state} /> : <span className="micro">OFF DUTY</span>}</td>
                        <td className="fs-12 text-mid">{st?.lastEvent ? `${st.lastEvent.name.replace(/_/g, ' ')} · ${formatTime(st.lastEvent.time)}` : '—'}</td>
                        <td><StatusBadge value={st?.gpsStatus} /></td>
                        <td>
                          <div className="row" style={{ gap: 5 }}>
                            <button className="btn btn-sm btn-ghost" title="View timeline" onClick={() => setTimelineEmp(e)}><FiEye size={12} /></button>
                            {canCreate && (
                              <button className="btn btn-sm btn-ghost" title={e.isActive ? 'Disable' : 'Reactivate'} onClick={() => toggleStatus(e._id)}>
                                <FiPower size={12} className={e.isActive ? 'text-red' : 'text-green'} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(data?.employees || []).length === 0 && <tr><td colSpan={9}><EmptyState title="No employees found" hint="Adjust the search or section filter." /></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="row-between" style={{ padding: 12, borderTop: '1px solid var(--line-soft)' }}>
              <span className="micro">PAGE {data?.page ?? 1} · {data?.total ?? 0} EMPLOYEES</span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>PREV</button>
                <button className="btn btn-sm" disabled={page * 15 >= (data?.total ?? 0)} onClick={() => setPage(page + 1)}>NEXT</button>
              </div>
            </div>
          </>
        )}
      </Panel>

      {showCreate && <CreateEmployeeModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['employees'] }); }} />}
      {timelineEmp && <EmployeeTimelineModal employee={timelineEmp} onClose={() => setTimelineEmp(null)} />}
    </div>
  );
}

function CreateEmployeeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const sectionsQ = useQuery({ queryKey: ['sections'], queryFn: sectionAPI.getAll, staleTime: 300_000 });
  const flowsQ = useQuery({ queryKey: ['flows-list'], queryFn: flowAPI.getAll, staleTime: 300_000 });
  const shiftsQ = useQuery({ queryKey: ['shifts'], queryFn: shiftAPI.getAll, staleTime: 300_000 });
  const [form, setForm] = useState({
    employeeId: '', fullName: '', email: '', phone: '', department: '', jobTitle: '',
    sectionId: '', flowId: '', shiftId: '', joiningDate: new Date().toISOString().slice(0, 10), employmentStatus: 'ACTIVE',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await employeeAPI.create(form);
      onCreated();
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed to create employee');
    } finally {
      setBusy(false);
    }
  };

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,10,0.78)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }} onClick={onClose}>
      <div className="panel" style={{ width: 'min(560px, 100%)', maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head"><span className="panel-title">New Employee File</span><button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button></div>
        <form onSubmit={submit} className="col" style={{ padding: 16, gap: 12 }}>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div><label className="form-label micro">EMPLOYEE ID *</label><input className="input" required value={form.employeeId} onChange={set('employeeId')} placeholder="EMP-XXXXX" /></div>
            <div><label className="form-label micro">FULL NAME *</label><input className="input" required value={form.fullName} onChange={set('fullName')} /></div>
            <div><label className="form-label micro">EMAIL *</label><input className="input" type="email" required value={form.email} onChange={set('email')} /></div>
            <div><label className="form-label micro">PHONE *</label><input className="input" required value={form.phone} onChange={set('phone')} /></div>
            <div><label className="form-label micro">DEPARTMENT *</label><input className="input" required value={form.department} onChange={set('department')} /></div>
            <div><label className="form-label micro">JOB TITLE *</label><input className="input" required value={form.jobTitle} onChange={set('jobTitle')} /></div>
            <div><label className="form-label micro">SECTION *</label>
              <select className="select" required value={form.sectionId} onChange={set('sectionId')}>
                <option value="">Select…</option>
                {(sectionsQ.data?.data || []).map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="form-label micro">FLOW *</label>
              <select className="select" required value={form.flowId} onChange={set('flowId')}>
                <option value="">Select…</option>
                {(flowsQ.data?.data || []).map((f: any) => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </div>
            <div><label className="form-label micro">SHIFT *</label>
              <select className="select" required value={form.shiftId} onChange={set('shiftId')}>
                <option value="">Select…</option>
                {(shiftsQ.data?.data || []).map((s: any) => <option key={s._id} value={s._id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
              </select>
            </div>
            <div><label className="form-label micro">JOINING DATE *</label><input className="input" type="date" required value={form.joiningDate} onChange={set('joiningDate')} /></div>
          </div>
          {err && <span className="badge badge-red">{err}</span>}
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>CANCEL</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'CREATING…' : 'CREATE EMPLOYEE'}</button>
          </div>
          <span className="micro">Login credentials are provisioned separately by an authorized administrator.</span>
        </form>
      </div>
    </div>
  );
}
