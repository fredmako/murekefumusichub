// Upload Composer Work - D1 + Custom JWT Version
import { useEffect, useState } from "react";
import { CheckCircle, Loader2, Upload, FileText, Music, Image } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Checkbox } from "@/app/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

interface UploadWorkProps {
  onClose: () => void;
  type: "composition" | "arrangement";
}

export default function UploadWork({ onClose, type }: UploadWorkProps) {
  const { appUser } = useAuth();
  const [formData, setFormData] = useState({
    title: "",
    categoryId: "",
    price: "",
    description: "",
    duration: "",
    language: "",
    accompaniment: "",
    voiceParts: "",
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [midiFile, setMidiFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [isFree, setIsFree] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        const filtered = (Array.isArray(data) ? data : []).filter(
          (c: any) =>
            c.name === "Compositions" ||
            c.name === "Arrangements" ||
            c.name === "compositions" ||
            c.name === "arrangements"
        );
        setCategories(filtered);
      })
      .catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "pdf" | "midi" | "thumbnail") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "pdf" && file.type === "application/pdf") {
      setPdfFile(file);
      toast.success("PDF selected");
    } else if (type === "midi" && (file.name.endsWith(".mid") || file.name.endsWith(".midi"))) {
      setMidiFile(file);
      toast.success("MIDI selected");
    } else if (type === "thumbnail" && file.type.startsWith("image/")) {
      setThumbnailFile(file);
      toast.success("Thumbnail selected");
    } else {
      toast.error("Invalid file type");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description) {
      toast.error("Title and description are required");
      return;
    }
    if (!pdfFile) {
      toast.error("Please select a PDF file");
      return;
    }
    if (!isFree && (!formData.price || parseFloat(formData.price) <= 0)) {
      toast.error("Please enter a valid price");
      return;
    }

    setUploading(true);

    try {
      const token = localStorage.getItem("murekefu_auth_token");
      if (!token) {
        toast.error("Not authenticated");
        setUploading(false);
        return;
      }

      // Step 1: Upload PDF
      const pdfFormData = new FormData();
      pdfFormData.append("file", pdfFile);
      pdfFormData.append("type", type);

      const uploadRes = await fetch("/api/upload/work", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: pdfFormData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || "File upload failed");
      }

      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.url || "";

      // Step 2: Upload MIDI (optional)
      let midiUrl = "";
      if (midiFile) {
        const midiFormData = new FormData();
        midiFormData.append("file", midiFile);
        midiFormData.append("type", type);

        const midiRes = await fetch("/api/upload/work", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: midiFormData,
        });

        if (midiRes.ok) {
          const midiData = await midiRes.json();
          midiUrl = midiData.url || "";
        }
      }

      // Step 3: Create the work record
      const endpoint = type === "arrangement" ? "/api/arrangements" : "/api/compositions";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category_id: formData.categoryId ? parseInt(formData.categoryId) : null,
          price: isFree ? 0 : parseFloat(formData.price),
          file_url: fileUrl,
          thumbnail_url: thumbnailFile ? URL.createObjectURL(thumbnailFile) : null,
          duration_seconds: formData.duration ? parseInt(formData.duration) : null,
          language: formData.language || null,
          accompaniment: formData.accompaniment || null,
          voice_parts: formData.voiceParts || null,
          is_published: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create record");
      }

      setSuccess(true);
      toast.success(`${type === "arrangement" ? "Arrangement" : "Composition"} uploaded successfully!`);

      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h3 className="text-xl font-bold mb-2">Upload Successful!</h3>
        <p className="text-muted-foreground">Your {type} has been uploaded to the marketplace.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
      <div>
        <Label>Title *</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder={`${type === "arrangement" ? "Arrangement" : "Composition"} title`}
          required
        />
      </div>

      <div>
        <Label>Description *</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe your work..."
          required
        />
      </div>

      <div>
        <Label>Category</Label>
        <Select
          value={formData.categoryId}
          onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={String(cat.id)}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={isFree}
          onCheckedChange={(c) => setIsFree(!!c)}
        />
        <Label>Free download</Label>
      </div>

      {!isFree && (
        <div>
          <Label>Price (KES) *</Label>
          <Input
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>
      )}

      <div>
        <Label>Duration (seconds)</Label>
        <Input
          type="number"
          value={formData.duration}
          onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
          placeholder="180"
        />
      </div>

      <div>
        <Label>Language</Label>
        <Input
          value={formData.language}
          onChange={(e) => setFormData({ ...formData, language: e.target.value })}
          placeholder="English, Latin, etc."
        />
      </div>

      <div>
        <Label>Accompaniment</Label>
        <Input
          value={formData.accompaniment}
          onChange={(e) => setFormData({ ...formData, accompaniment: e.target.value })}
          placeholder="Piano, Organ, A cappella, etc."
        />
      </div>

      <div>
        <Label>Voice Parts</Label>
        <Input
          value={formData.voiceParts}
          onChange={(e) => setFormData({ ...formData, voiceParts: e.target.value })}
          placeholder="Soprano, Alto, Tenor, Bass"
        />
      </div>

      <div>
        <Label>PDF Score *</Label>
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => handleFileChange(e, "pdf")}
            className="hidden"
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload" className="cursor-pointer">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {pdfFile ? pdfFile.name : "Click to upload PDF"}
            </p>
          </label>
        </div>
      </div>

      <div>
        <Label>MIDI File (optional)</Label>
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <input
            type="file"
            accept=".mid,.midi"
            onChange={(e) => handleFileChange(e, "midi")}
            className="hidden"
            id="midi-upload"
          />
          <label htmlFor="midi-upload" className="cursor-pointer">
            <Music className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {midiFile ? midiFile.name : "Click to upload MIDI"}
            </p>
          </label>
        </div>
      </div>

      <div>
        <Label>Thumbnail (optional)</Label>
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e, "thumbnail")}
            className="hidden"
            id="thumbnail-upload"
          />
          <label htmlFor="thumbnail-upload" className="cursor-pointer">
            <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {thumbnailFile ? thumbnailFile.name : "Click to upload thumbnail"}
            </p>
          </label>
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={uploading} className="flex-1">
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload {type === "arrangement" ? "Arrangement" : "Composition"}
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
