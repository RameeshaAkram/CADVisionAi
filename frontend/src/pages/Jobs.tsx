import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJobs } from '../api/jobs';
import { formatDistanceToNow } from 'date-fns';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-cyan-100 text-cyan-800 border border-cyan-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border border-gray-200'; // no green
      case 'failed': return 'bg-red-100 text-red-800 border border-red-200'; // vermilion
      case 'needs_more_views': return 'bg-amber-100 text-amber-800 border border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const handleRowClick = (job: any) => {
    if (job.status === 'processing') {
      navigate(`/jobs/${job.job_id}`);
    } else {
      navigate(`/jobs/${job.job_id}/view`);
    }
  };

  return (
    <div className="flex-1 bg-white flex flex-col p-8 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-6 text-gray-900">Jobs</h1>
      
      {loading ? (
        <div className="text-gray-500">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-lg paper-scope">
          <p className="text-gray-500 mb-4">Nothing reconstructed yet.</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-900 text-white rounded font-medium hover:bg-gray-800"
          >
            New reconstruction
          </button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-sm font-medium text-gray-500 w-16">Preview</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Job ID</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Files</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr 
                  key={job.job_id} 
                  onClick={() => handleRowClick(job)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    {job.thumbnail_url ? (
                      <img src={`http://localhost:8000${job.thumbnail_url}`} className="w-10 h-10 object-cover rounded bg-gray-100" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded"></div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {job.job_id.substring(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full inline-flex items-center gap-1.5 ${getStatusColor(job.status)}`}>
                      {job.status === 'processing' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>}
                      {job.status === 'completed' && <span className="text-gray-500 text-[10px]">✔</span>}
                      {job.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {job.file_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono text-right">
                    {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
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
