import { create } from 'zustand';

interface JobState {
  currentJobId: string | null;
  setJobId: (id: string | null) => void;
}

export const useJobStore = create<JobState>((set) => ({
  currentJobId: null,
  setJobId: (id) => set({ currentJobId: id }),
}));
