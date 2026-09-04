import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJobs } from '../api/jobs';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, Box, Plus } from 'lucide-react';

export const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getJobs().then((data) => {
      setJobs(data.jobs);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handleRowClick = (job: any) => {
    if (job.status === 'processing') {
      navigate(`/jobs/${job.job_id}`);
    } else {
      navigate(`/jobs/${job.job_id}/view`);
    }
  };

  return (
    <div className="flex-1 max-w-[1180px] mx-auto w-full px-5 py-8 md:px-10 md:py-12">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div><div className="eyebrow mb-3">CADVision AI / Library</div><h1 className="text-[34px] md:text-[40px] font-semibold leading-none tracking-[-0.03em]">Reconstruction jobs</h1><p className="text-[14px] text-[var(--g-400)] mt-3">Review generated profiles and return to unfinished captures.</p></div>
        <button onClick={() => navigate('/')} className="btn btn-primary"><Plus className="w-4 h-4" /> New job</button>
      </div>
      
      {loading ? (
        <div className="text-[var(--g-400)] font-data text-[13px]">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="step-card flex flex-col items-center justify-center py-20">
          <Box className="w-8 h-8 text-[var(--g-500)] mb-4" />
          <p className="text-[var(--g-300)] mb-4">No reconstruction jobs yet.</p>
          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary"
          >
            New reconstruction
          </button>
        </div>
      ) : (
        <div className="jobs-table">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--g-850)]">
                <th className="px-4 py-4 w-16">Preview</th>
                <th className="px-4 py-4">Job ID</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Inputs</th>
                <th className="px-4 py-4 text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr 
                  key={job.job_id} 
                  onClick={() => handleRowClick(job)}
                  className="jobs-row cursor-pointer"
                >
                  <td className="px-4 py-3">
                    {job.thumbnail_url ? (
                      <img src={job.thumbnail_url} className="w-11 h-11 object-cover rounded-[3px] border border-[var(--g-700)]" />
                    ) : (
                      <div className="w-11 h-11 bg-[var(--g-800)] border border-[var(--g-700)] rounded-[3px] grid place-items-center"><Box className="w-4 h-4 text-[var(--g-500)]" /></div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-data text-[var(--g-300)]">
                    {job.job_id.substring(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status-pill ${job.status}`}>
                      {(job.status === 'processing' || job.status === 'completed') && <span className={`status-dot ${job.status === 'processing' ? 'animate-pulse' : ''}`}></span>}
                      {job.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[var(--g-300)]">
                    <span className="font-data">{job.file_count}</span> file{job.file_count === 1 ? '' : 's'} <span className="text-[var(--g-500)]">/ {job.units}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[var(--g-400)] font-data text-right">
                    {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    <ArrowUpRight className="inline w-3.5 h-3.5 ml-2 text-[var(--g-500)]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
