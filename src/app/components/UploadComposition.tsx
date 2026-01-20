import { useState } from 'react';
import { Upload, CheckCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';

interface UploadCompositionProps {
  onClose: () => void;
}

export function UploadComposition({ onClose }: UploadCompositionProps) {
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    description: '',
    difficulty: '',
    duration: '',
    language: '',
    accompaniment: '',
    voiceParts: [] as string[],
  });

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const voicePartOptions = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Soprano I', 'Soprano II'];

  const handleVoicePartToggle = (part: string) => {
    setFormData(prev => ({
      ...prev,
      voiceParts: prev.voiceParts.includes(part)
        ? prev.voiceParts.filter(p => p !== part)
        : [...prev.voiceParts, part]
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      toast.success('PDF file selected successfully');
    } else {
      toast.error('Please select a valid PDF file');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let pdfUrl = '';

      // Upload PDF to Firebase Storage if a file is selected
      if (pdfFile) {
        const storageRef = ref(storage, `compositions/${Date.now()}_${pdfFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, pdfFile);

        // Listen for upload progress
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            console.error('Upload error:', error);
            toast.error('Failed to upload PDF file');
            setIsSubmitting(false);
          },
          async () => {
            // Upload completed successfully, get the download URL
            pdfUrl = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Here you would normally save the composition data to your database
            console.log('Composition data:', { ...formData, pdfUrl });
            
            toast.success('Composition uploaded successfully!');
            setIsSuccess(true);

            // Close after success
            setTimeout(() => {
              onClose();
            }, 1500);
          }
        );
      } else {
        // No file selected, just simulate upload
        setTimeout(() => {
          setIsSubmitting(false);
          setIsSuccess(true);

          // Close after success
          setTimeout(() => {
            onClose();
          }, 1500);
        }, 1500);
      }
    } catch (error) {
      console.error('Error uploading composition:', error);
      toast.error('Failed to upload composition');
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CheckCircle className="size-16 text-green-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Upload Successful!</h3>
        <p className="text-gray-600">Your composition has been added to the marketplace.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <Label htmlFor="title">Composition Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="e.g., Ave Maria"
          required
        />
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe your composition, its mood, suitable occasions..."
          rows={4}
          required
        />
      </div>

      {/* Price */}
      <div>
        <Label htmlFor="price">Price (USD) *</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          min="0"
          value={formData.price}
          onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
          placeholder="29.99"
          required
        />
      </div>

      {/* Voice Parts */}
      <div>
        <Label>Voice Parts *</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {voicePartOptions.map(part => (
            <div key={part} className="flex items-center space-x-2">
              <Checkbox
                id={`voice-${part}`}
                checked={formData.voiceParts.includes(part)}
                onCheckedChange={() => handleVoicePartToggle(part)}
              />
              <label
                htmlFor={`voice-${part}`}
                className="text-sm cursor-pointer"
              >
                {part}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <Label htmlFor="difficulty">Difficulty Level *</Label>
        <Select
          value={formData.difficulty}
          onValueChange={(value) => setFormData(prev => ({ ...prev, difficulty: value }))}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Duration */}
      <div>
        <Label htmlFor="duration">Duration *</Label>
        <Input
          id="duration"
          value={formData.duration}
          onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
          placeholder="e.g., 4:30"
          required
        />
      </div>

      {/* Language */}
      <div>
        <Label htmlFor="language">Language *</Label>
        <Select
          value={formData.language}
          onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="English">English</SelectItem>
            <SelectItem value="Latin">Latin</SelectItem>
            <SelectItem value="German">German</SelectItem>
            <SelectItem value="French">French</SelectItem>
            <SelectItem value="Italian">Italian</SelectItem>
            <SelectItem value="Spanish">Spanish</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Accompaniment */}
      <div>
        <Label htmlFor="accompaniment">Accompaniment *</Label>
        <Select
          value={formData.accompaniment}
          onValueChange={(value) => setFormData(prev => ({ ...prev, accompaniment: value }))}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select accompaniment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A cappella">A cappella</SelectItem>
            <SelectItem value="Piano">Piano</SelectItem>
            <SelectItem value="Organ">Organ</SelectItem>
            <SelectItem value="String Quartet">String Quartet</SelectItem>
            <SelectItem value="Orchestra">Orchestra</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* File Upload */}
      <div>
        <Label htmlFor="file">PDF Score {uploadProgress > 0 && uploadProgress < 100 && `(${Math.round(uploadProgress)}%)`}</Label>
        <div className="mt-2">
          <Input
            id="file"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
          {pdfFile && (
            <p className="text-sm text-gray-600 mt-2">Selected: {pdfFile.name}</p>
          )}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Uploading...' : 'Upload Composition'}
        </Button>
      </div>
    </form>
  );
}