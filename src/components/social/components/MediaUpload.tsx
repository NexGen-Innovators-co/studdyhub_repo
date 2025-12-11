import React, { useRef } from 'react';
import { Button } from '../../ui/button';
import { Image, Video, FileText, X, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import { MediaUploadProps } from '../types/social';

export const MediaUpload: React.FC<MediaUploadProps> = ({
  selectedFiles,
  onFilesChange,
  onFileSelect,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { canPostSocials } = useFeatureAccess();
  const canUploadMedia = canPostSocials();

  const requireSocialAccess = () => {
    if (!canUploadMedia) {
      toast.error('Media uploads are available for Scholar and Genius plans', {
        action: {
          label: 'Upgrade',
          onClick: () => navigate('/subscription'),
        },
        duration: 5000,
      });
      return false;
    }
    return true;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    onFilesChange([...selectedFiles, ...files]);
  };

  const removeFile = (index: number) => {
    onFilesChange(selectedFiles.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx,.txt"
        multiple
        onChange={handleFileSelect}
        disabled={!canUploadMedia}
        className="hidden"
      />

      {/* File Preview */}
      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative group">
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="h-8 w-8 mx-auto mb-1" />
                    <p className="text-xs truncate px-2">{file.name}</p>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeFile(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => requireSocialAccess() && fileInputRef.current?.click()}
          disabled={!canUploadMedia}
          title={!canUploadMedia ? 'Upgrade to Scholar or Genius to upload media' : 'Upload a photo'}
          className="text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {canUploadMedia ? <Image className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
          Photo
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => requireSocialAccess() && fileInputRef.current?.click()}
          disabled={!canUploadMedia}
          title={!canUploadMedia ? 'Upgrade to Scholar or Genius to upload media' : 'Upload a video'}
        >
          {canUploadMedia ? <Video className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
          Video
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => requireSocialAccess() && fileInputRef.current?.click()}
          disabled={!canUploadMedia}
          title={!canUploadMedia ? 'Upgrade to Scholar or Genius to upload documents' : 'Upload a document'}
        >
          {canUploadMedia ? <FileText className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
          Document
        </Button>
      </div>
    </div>
  );
};