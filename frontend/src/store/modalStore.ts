import { create } from 'zustand';

interface ModalState {
  isQuickAddOpen: boolean;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;

  isCalibrateOpen: boolean;
  openCalibrate: () => void;
  closeCalibrate: () => void;

  isDiscardModalOpen: boolean;
  openDiscardModal: () => void;
  closeDiscardModal: () => void;

  isSleepNoteOpen: boolean;
  openSleepNote: () => void;
  closeSleepNote: () => void;

  isAiCoachOpen: boolean;
  openAiCoach: () => void;
  closeAiCoach: () => void;

  isLiveVoiceOpen: boolean;
  openLiveVoice: () => void;
  closeLiveVoice: () => void;

  isMealScannerOpen: boolean;
  openMealScanner: () => void;
  closeMealScanner: () => void;

  isWeeklyReportOpen: boolean;
  openWeeklyReport: () => void;
  closeWeeklyReport: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  isQuickAddOpen: false,
  openQuickAdd: () => set({ isQuickAddOpen: true }),
  closeQuickAdd: () => set({ isQuickAddOpen: false }),

  isCalibrateOpen: false,
  openCalibrate: () => set({ isCalibrateOpen: true }),
  closeCalibrate: () => set({ isCalibrateOpen: false }),

  isDiscardModalOpen: false,
  openDiscardModal: () => set({ isDiscardModalOpen: true }),
  closeDiscardModal: () => set({ isDiscardModalOpen: false }),

  isSleepNoteOpen: false,
  openSleepNote: () => set({ isSleepNoteOpen: true }),
  closeSleepNote: () => set({ isSleepNoteOpen: false }),

  isAiCoachOpen: false,
  openAiCoach: () => set({ isAiCoachOpen: true }),
  closeAiCoach: () => set({ isAiCoachOpen: false }),

  isLiveVoiceOpen: false,
  openLiveVoice: () => set({ isLiveVoiceOpen: true }),
  closeLiveVoice: () => set({ isLiveVoiceOpen: false }),

  isMealScannerOpen: false,
  openMealScanner: () => set({ isMealScannerOpen: true }),
  closeMealScanner: () => set({ isMealScannerOpen: false }),

  isWeeklyReportOpen: false,
  openWeeklyReport: () => set({ isWeeklyReportOpen: true }),
  closeWeeklyReport: () => set({ isWeeklyReportOpen: false }),
}));
