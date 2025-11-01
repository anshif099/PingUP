import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface UpdateInfo {
  version: string;
  features: string[];
  changelog: string;
  downloadUrl?: string;
  size?: string;
  releaseDate: string;
}

interface UpdateState {
  isChecking: boolean;
  isDownloading: boolean;
  isInstalling: boolean;
  updateAvailable: boolean;
  updateInfo: UpdateInfo | null;
  currentVersion: string;
  downloadProgress: number;
}

export const useUpdate = () => {
  const [updateState, setUpdateState] = useState<UpdateState>({
    isChecking: false,
    isDownloading: false,
    isInstalling: false,
    updateAvailable: false,
    updateInfo: null,
    currentVersion: '1.5.0',
    downloadProgress: 0,
  });

  // Check for updates
  const checkForUpdates = async () => {
    setUpdateState(prev => ({ ...prev, isChecking: true }));

    try {
      // Fetch update info from public/updates.json
      const response = await fetch('/updates.json');
      const data = await response.json();
      const latestUpdate: UpdateInfo = data.latest;

      const hasUpdate = latestUpdate.version !== updateState.currentVersion;

      setUpdateState(prev => ({
        ...prev,
        isChecking: false,
        updateAvailable: hasUpdate,
        updateInfo: hasUpdate ? latestUpdate : null,
      }));

      return hasUpdate;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      setUpdateState(prev => ({ ...prev, isChecking: false }));
      return false;
    }
  };

  // Download update
  const downloadUpdate = async () => {
    if (!updateState.updateInfo) return;

    setUpdateState(prev => ({ ...prev, isDownloading: true, downloadProgress: 0 }));

    try {
      // Simulate download progress
      const interval = setInterval(() => {
        setUpdateState(prev => {
          const newProgress = Math.min(prev.downloadProgress + Math.random() * 15, 100);
          return { ...prev, downloadProgress: newProgress };
        });
      }, 500);

      // In a real app, download the update files
      // For demo, we'll simulate a delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      clearInterval(interval);
      setUpdateState(prev => ({
        ...prev,
        isDownloading: false,
        downloadProgress: 100
      }));

      return true;
    } catch (error) {
      console.error('Failed to download update:', error);
      setUpdateState(prev => ({
        ...prev,
        isDownloading: false,
        downloadProgress: 0
      }));
      return false;
    }
  };

  // Install update
  const installUpdate = async () => {
    setUpdateState(prev => ({ ...prev, isInstalling: true }));

    try {
      // In a real app, this would extract and install the downloaded files
      // For web apps, this might involve service worker cache updates
      // For mobile, it might involve replacing app assets

      await new Promise(resolve => setTimeout(resolve, 2000));

      setUpdateState(prev => ({
        ...prev,
        isInstalling: false,
        updateAvailable: false,
        updateInfo: null,
      }));

      return true;
    } catch (error) {
      console.error('Failed to install update:', error);
      setUpdateState(prev => ({ ...prev, isInstalling: false }));
      return false;
    }
  };

  // Restart app
  const restartApp = () => {
    // For web apps, reload the page
    window.location.reload();
  };

  // Skip update
  const skipUpdate = () => {
    setUpdateState(prev => ({
      ...prev,
      updateAvailable: false,
      updateInfo: null,
    }));
  };

  // Check for updates on mount
  useEffect(() => {
    // Auto-check for updates on app start
    const autoCheckUpdates = async () => {
      const hasUpdate = await checkForUpdates();
      if (hasUpdate) {
        toast.info("Update available! Check the update button for details.");
      }
    };

    // Delay auto-check to avoid immediate popup on app load
    const timer = setTimeout(autoCheckUpdates, 2000);
    return () => clearTimeout(timer);
  }, []);

  return {
    ...updateState,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    restartApp,
    skipUpdate,
  };
};
