import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Download, RefreshCw, CheckCircle, X, Info } from 'lucide-react';
import { useUpdate } from '@/hooks/useUpdate';
import { toast } from 'sonner';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UpdateDialog = ({ open, onOpenChange }: UpdateDialogProps) => {
  const {
    isChecking,
    isDownloading,
    isInstalling,
    updateAvailable,
    updateInfo,
    downloadProgress,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    restartApp,
    skipUpdate,
  } = useUpdate();

  const [step, setStep] = useState<'check' | 'download' | 'install' | 'restart'>('check');

  const handleCheckUpdates = async () => {
    setStep('check');
    const hasUpdate = await checkForUpdates();
    if (!hasUpdate) {
      toast.success("You're up to date!");
    }
  };

  const handleDownload = async () => {
    setStep('download');
    const success = await downloadUpdate();
    if (success) {
      setStep('install');
    } else {
      toast.error('Download failed. Please try again.');
      setStep('check');
    }
  };

  const handleInstall = async () => {
    setStep('install');
    const success = await installUpdate();
    if (success) {
      setStep('restart');
      toast.success('Update installed successfully!');
    } else {
      toast.error('Installation failed. Please try again.');
      setStep('check');
    }
  };

  const handleRestart = () => {
    restartApp();
  };

  const handleSkip = () => {
    skipUpdate();
    onOpenChange(false);
  };

  const renderContent = () => {
    if (isChecking) {
      return (
        <div className="flex flex-col items-center gap-4 py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-center">Checking for updates...</p>
        </div>
      );
    }

    if (!updateAvailable) {
      return (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle className="w-12 h-12 text-green-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">You're up to date!</h3>
            <p className="text-muted-foreground">PingUP v{updateInfo?.version || '1.1.0'} is the latest version.</p>
          </div>
          <Button onClick={handleCheckUpdates} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Check Again
          </Button>
        </div>
      );
    }

    if (updateInfo) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Info className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold">Update Available</h3>
              <p className="text-sm text-muted-foreground">
                PingUP v{updateInfo.version} is ready to install
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                What's New in v{updateInfo.version}
                <Badge variant="secondary">New</Badge>
              </CardTitle>
              <CardDescription>
                Released on {new Date(updateInfo.releaseDate).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">New Features:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {updateInfo.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Changelog:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {updateInfo.changelog}
                </p>
              </div>

              {updateInfo.size && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Download size: {updateInfo.size}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {step === 'download' && isDownloading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Downloading update...</span>
                <span>{Math.round(downloadProgress)}%</span>
              </div>
              <Progress value={downloadProgress} className="w-full" />
            </div>
          )}

          {step === 'install' && isInstalling && (
            <div className="flex flex-col items-center gap-4 py-4">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-center">Installing update...</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {step === 'check' && (
              <>
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Download Update
                </Button>
                <Button onClick={handleSkip} variant="outline">
                  Skip
                </Button>
              </>
            )}

            {step === 'download' && !isDownloading && (
              <Button onClick={handleDownload} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Start Download
              </Button>
            )}

            {step === 'install' && !isInstalling && (
              <Button onClick={handleInstall} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Install Update
              </Button>
            )}

            {step === 'restart' && (
              <Button onClick={handleRestart} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Restart App
              </Button>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>App Updates</DialogTitle>
          <DialogDescription>
            Keep PingUP up to date with the latest features and improvements.
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};
