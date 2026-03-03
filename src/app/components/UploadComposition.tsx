import { useState } from "react";
import { Upload, CheckCircle } from "lucide-react";
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
import { supabase } from "@/lib/supabase";
import { API_BASE_URL } from "@/lib/apiBase";
import { toast } from "sonner";

interface UploadCompositionProps {
  onClose: () => void;
}

interface AnalyzedCompositionMetadata {
  title?: string;
  description?: string;
  difficulty?: string;
  duration?: string;
  language?: string;
  accompaniment?: string;
  voiceParts?: string[];
}

type MetadataMode = "ai" | "manual";
type SelectOrOther = string;

const CURRENCY_OPTIONS = [
  { value: "KES", label: "Kenyan Shilling (KES)" },
  { value: "USD", label: "US Dollar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "Other", label: "Other (Specify)" },
];

const DIFFICULTY_OPTIONS = ["Easy", "Intermediate", "Advanced", "Other"];
const LANGUAGE_OPTIONS = [
  "English",
  "Latin",
  "German",
  "French",
  "Italian",
  "Spanish",
  "Other",
];
const ACCOMPANIMENT_OPTIONS = [
  "A cappella",
  "Piano",
  "Organ",
  "String Quartet",
  "Orchestra",
  "Other",
];

export function UploadComposition({ onClose }: UploadCompositionProps) {
  const [formData, setFormData] = useState({
    title: "",
    price: "",
    currency: "USD" as SelectOrOther,
    customCurrency: "",
    description: "",
    difficulty: "" as SelectOrOther,
    customDifficulty: "",
    duration: "",
    language: "" as SelectOrOther,
    customLanguage: "",
    accompaniment: "" as SelectOrOther,
    customAccompaniment: "",
    voiceParts: [] as string[],
    customVoicePart: "",
  });

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [metadataMode, setMetadataMode] = useState<MetadataMode>("manual");

  const voicePartOptions = [
    "Soprano",
    "Alto",
    "Tenor",
    "Bass",
    "Soprano I",
    "Soprano II",
  ];

  const resolveCustomOrPreset = (
    selectedValue: SelectOrOther,
    customValue: string,
  ) => {
    if (selectedValue === "Other") return customValue.trim();
    return selectedValue.trim();
  };

  const resolvedCurrency = resolveCustomOrPreset(
    formData.currency,
    formData.customCurrency,
  ).toUpperCase();
  const resolvedDifficulty = resolveCustomOrPreset(
    formData.difficulty,
    formData.customDifficulty,
  );
  const resolvedLanguage = resolveCustomOrPreset(
    formData.language,
    formData.customLanguage,
  );
  const resolvedAccompaniment = resolveCustomOrPreset(
    formData.accompaniment,
    formData.customAccompaniment,
  );

  const handleAddCustomVoicePart = () => {
    const value = formData.customVoicePart.trim();
    if (!value) return;

    const exists = formData.voiceParts.some(
      (part) => part.toLowerCase() === value.toLowerCase(),
    );
    if (exists) {
      toast.error("Voice part already added");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      voiceParts: [...prev.voiceParts, value],
      customVoicePart: "",
    }));
  };

  const handleRemoveVoicePart = (partToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      voiceParts: prev.voiceParts.filter((part) => part !== partToRemove),
    }));
  };

  const handleVoicePartToggle = (part: string) => {
    setFormData((prev) => ({
      ...prev,
      voiceParts: prev.voiceParts.includes(part)
        ? prev.voiceParts.filter((p) => p !== part)
        : [...prev.voiceParts, part],
    }));
  };

  const applyAnalyzedMetadata = (metadata: AnalyzedCompositionMetadata) => {
    const detectedDifficulty = metadata.difficulty || "";
    const detectedLanguage = metadata.language || "";
    const detectedAccompaniment = metadata.accompaniment || "";
    const isKnownDifficulty = DIFFICULTY_OPTIONS
      .filter((item) => item !== "Other")
      .some((item) => item.toLowerCase() === detectedDifficulty.toLowerCase());
    const isKnownLanguage = LANGUAGE_OPTIONS
      .filter((item) => item !== "Other")
      .some((item) => item.toLowerCase() === detectedLanguage.toLowerCase());
    const isKnownAccompaniment = ACCOMPANIMENT_OPTIONS
      .filter((item) => item !== "Other")
      .some((item) => item.toLowerCase() === detectedAccompaniment.toLowerCase());

    setFormData((prev) => ({
      ...prev,
      title: prev.title || metadata.title || "",
      description: prev.description || metadata.description || "",
      difficulty: prev.difficulty
        ? prev.difficulty
        : detectedDifficulty
          ? isKnownDifficulty
            ? detectedDifficulty
            : "Other"
          : "",
      customDifficulty:
        prev.customDifficulty ||
        (detectedDifficulty && !isKnownDifficulty ? detectedDifficulty : ""),
      duration: prev.duration || metadata.duration || "",
      language: prev.language
        ? prev.language
        : detectedLanguage
          ? isKnownLanguage
            ? detectedLanguage
            : "Other"
          : "",
      customLanguage:
        prev.customLanguage ||
        (detectedLanguage && !isKnownLanguage ? detectedLanguage : ""),
      accompaniment: prev.accompaniment
        ? prev.accompaniment
        : detectedAccompaniment
          ? isKnownAccompaniment
            ? detectedAccompaniment
            : "Other"
          : "",
      customAccompaniment:
        prev.customAccompaniment ||
        (detectedAccompaniment && !isKnownAccompaniment
          ? detectedAccompaniment
          : ""),
      voiceParts:
        prev.voiceParts.length > 0
          ? prev.voiceParts
          : Array.isArray(metadata.voiceParts)
            ? metadata.voiceParts
            : [],
    }));
  };

  const getFreshAccessToken = async (): Promise<string | null> => {
    try {
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();
      if (!refreshError && refreshData?.session?.access_token) {
        return refreshData.session.access_token;
      }
    } catch {
      // Ignore refresh errors and fall back to current session.
    }

    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData?.session?.access_token ?? null;
  };

  const analyzePdf = async (file: File) => {
    try {
      setIsAnalyzingPdf(true);

      const token = await getFreshAccessToken();
      if (!token) {
        toast.error("Not authenticated for PDF analysis");
        return;
      }

      const body = new FormData();
      body.append("file", file);

      const response = await fetch(`${API_BASE_URL}/compositions/analyze-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      if (!response.ok) {
        let message = "PDF analysis failed";
        try {
          const errorData = await response.json();
          message = errorData?.message || message;
        } catch {
          // ignore parse failures
        }
        toast.error(message);
        return;
      }

      const result = await response.json();
      if (!result?.success || !result?.metadata) {
        toast.error("PDF analysis returned no metadata");
        return;
      }

      applyAnalyzedMetadata(result.metadata);
      toast.success("PDF analyzed. Review suggested fields.");
    } catch (error) {
      console.error("Error analyzing PDF:", error);
      toast.error("Could not analyze this PDF automatically");
    } finally {
      setIsAnalyzingPdf(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      toast.success("PDF file selected successfully");
      if (metadataMode === "ai") {
        void analyzePdf(file);
      }
    } else {
      toast.error("Please select a valid PDF file");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate form data
      const parsedPrice = Number.parseFloat(formData.price);
      if (!formData.title || !formData.description.trim()) {
        toast.error("Please fill in title and description");
        setIsSubmitting(false);
        return;
      }

      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        toast.error("Please enter a valid non-negative price");
        setIsSubmitting(false);
        return;
      }

      if (
        !resolvedCurrency ||
        !resolvedDifficulty ||
        !resolvedLanguage ||
        !resolvedAccompaniment
      ) {
        toast.error("Please fill in all required fields");
        setIsSubmitting(false);
        return;
      }

      if (formData.voiceParts.length === 0) {
        toast.error("Please add at least one voice part");
        setIsSubmitting(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData?.session?.user;
      if (!authUser) {
        toast.error("Not authenticated");
        setIsSubmitting(false);
        return;
      }

      const token = await getFreshAccessToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      let pdfUrl = "";

      // Step 1: Upload PDF to Supabase storage bucket
      if (pdfFile) {
        setUploadProgress(15);
        const uploadFormData = new FormData();
        uploadFormData.append("file", pdfFile);

        // Get Supabase access token
        // Upload via Supabase bucket endpoint
        const uploadResponse = await fetch(
          `${API_BASE_URL}/upload/compositions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: uploadFormData,
          },
        );

        if (!uploadResponse.ok) {
          let errorData: any = {};
          try {
            errorData = await uploadResponse.json();
          } catch {
            // ignore parse errors
          }
          const uploadMessage =
            errorData?.message ||
            errorData?.error ||
            errorData?.details ||
            `Upload failed (${uploadResponse.status})`;
          console.error("[UploadComposition] file upload failed", {
            status: uploadResponse.status,
            body: errorData,
          });
          throw new Error(uploadMessage);
        }

        const uploadData = await uploadResponse.json();
        pdfUrl = uploadData.url;
        setUploadProgress(100);
      } else {
        toast.error("Please select a PDF file");
        setIsSubmitting(false);
        return;
      }

      // Step 2: Save composition metadata through backend API.
      // Server resolves composer_id from authenticated user.
      const createResponse = await fetch(`${API_BASE_URL}/compositions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          price: parsedPrice,
          price_currency: resolvedCurrency,
          difficulty: resolvedDifficulty,
          duration: formData.duration || null,
          language: resolvedLanguage,
          accompaniment: resolvedAccompaniment,
          voice_parts:
            formData.voiceParts.length > 0 ? formData.voiceParts : null,
          pdf_url: pdfUrl,
          is_published: true,
        }),
      });

      if (!createResponse.ok) {
        let errorMessage = "Failed to save composition to database";
        let errorData: any = {};
        try {
          errorData = await createResponse.json();
          errorMessage =
            errorData?.message || errorData?.error || errorMessage;
        } catch {
          // ignore parse failures
        }
        console.error("[UploadComposition] composition create failed", {
          status: createResponse.status,
          body: errorData,
          payload: {
            title: formData.title,
            price: formData.price,
            price_currency: resolvedCurrency,
            difficulty: resolvedDifficulty,
            language: resolvedLanguage,
            accompaniment: resolvedAccompaniment,
            hasPdfUrl: Boolean(pdfUrl),
          },
        });
        throw new Error(errorMessage);
      }

      toast.success("Composition uploaded successfully!");
      setIsSuccess(true);

      // Close after success
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error uploading composition:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload composition",
      );
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CheckCircle className="size-16 text-green-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Upload Successful!</h3>
        <p className="text-gray-600">
          Your composition has been added to the marketplace.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Metadata Entry Mode */}
      <div>
        <Label>How would you like to fill composition details?</Label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            type="button"
            variant={metadataMode === "ai" ? "default" : "outline"}
            onClick={() => setMetadataMode("ai")}
            disabled={isSubmitting}
          >
            AI Analyze
          </Button>
          <Button
            type="button"
            variant={metadataMode === "manual" ? "default" : "outline"}
            onClick={() => setMetadataMode("manual")}
            disabled={isSubmitting}
          >
            Manual Fill
          </Button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          {metadataMode === "ai"
            ? "Upload a PDF and AI will suggest details. You can edit every field before publishing."
            : "Fill all required details manually. PDF analysis will not run automatically."}
        </p>
      </div>

      {/* Title */}
      <div>
        <Label htmlFor="title">Composition Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, title: e.target.value }))
          }
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
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Describe your composition, its mood, suitable occasions..."
          rows={4}
          required
        />
      </div>

      {/* Price */}
      <div>
        <Label>Price *</Label>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Select
              value={formData.currency}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  currency: value,
                  customCurrency: value === "Other" ? prev.customCurrency : "",
                }))
              }
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, price: e.target.value }))
              }
              placeholder={
                formData.currency === "KES"
                  ? "e.g., 3500"
                  : formData.currency === "EUR"
                    ? "e.g., 25.00"
                    : "e.g., 29.99"
              }
              required
            />
          </div>
        </div>
        {formData.currency === "Other" && (
          <Input
            className="mt-3"
            value={formData.customCurrency}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                customCurrency: e.target.value.toUpperCase(),
              }))
            }
            placeholder="Enter currency code or name (e.g., GBP)"
            required
          />
        )}
        <p className="mt-2 text-xs text-gray-600">
          Select currency first, then enter the numeric amount.
        </p>
      </div>

      {/* Voice Parts */}
      <div>
        <Label>Voice Parts *</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {voicePartOptions.map((part) => (
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
        <div className="mt-3 flex gap-2">
          <Input
            value={formData.customVoicePart}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, customVoicePart: e.target.value }))
            }
            placeholder="Add custom voice part"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddCustomVoicePart}
            disabled={!formData.customVoicePart.trim()}
          >
            Add
          </Button>
        </div>
        {formData.voiceParts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {formData.voiceParts.map((part) => (
              <button
                key={part}
                type="button"
                className="rounded-full border border-border bg-muted px-3 py-1 text-xs hover:bg-muted/80"
                onClick={() => handleRemoveVoicePart(part)}
              >
                {part} x
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-600 mt-2">
          Use the custom field for non-standard divisions. Click a selected part
          to remove it.
        </p>
      </div>

      {/* Difficulty */}
      <div>
        <Label htmlFor="difficulty">Difficulty Level *</Label>
        <Select
          value={formData.difficulty}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              difficulty: value,
              customDifficulty: value === "Other" ? prev.customDifficulty : "",
            }))
          }
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select difficulty" />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {formData.difficulty === "Other" && (
          <Input
            className="mt-3"
            value={formData.customDifficulty}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                customDifficulty: e.target.value,
              }))
            }
            placeholder="Specify custom difficulty"
            required
          />
        )}
      </div>

      {/* Duration */}
      <div>
        <Label htmlFor="duration">Duration *</Label>
        <Input
          id="duration"
          value={formData.duration}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, duration: e.target.value }))
          }
          placeholder="e.g., 4:30"
          required
        />
      </div>

      {/* Language */}
      <div>
        <Label htmlFor="language">Language *</Label>
        <Select
          value={formData.language}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              language: value,
              customLanguage: value === "Other" ? prev.customLanguage : "",
            }))
          }
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {formData.language === "Other" && (
          <Input
            className="mt-3"
            value={formData.customLanguage}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                customLanguage: e.target.value,
              }))
            }
            placeholder="Specify language"
            required
          />
        )}
      </div>

      {/* Accompaniment */}
      <div>
        <Label htmlFor="accompaniment">Accompaniment *</Label>
        <Select
          value={formData.accompaniment}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              accompaniment: value,
              customAccompaniment:
                value === "Other" ? prev.customAccompaniment : "",
            }))
          }
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select accompaniment" />
          </SelectTrigger>
          <SelectContent>
            {ACCOMPANIMENT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {formData.accompaniment === "Other" && (
          <Input
            className="mt-3"
            value={formData.customAccompaniment}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                customAccompaniment: e.target.value,
              }))
            }
            placeholder="Specify accompaniment"
            required
          />
        )}
      </div>

      {/* File Upload */}
      <div>
        <Label htmlFor="file">
          PDF Score{" "}
          {uploadProgress > 0 &&
            uploadProgress < 100 &&
            `(${Math.round(uploadProgress)}%)`}
        </Label>
        <div className="mt-2">
          <Input
            id="file"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
          {pdfFile && (
            <p className="text-sm text-gray-600 mt-2">
              Selected: {pdfFile.name}
            </p>
          )}
          {pdfFile && metadataMode === "ai" && (
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => void analyzePdf(pdfFile)}
              disabled={isAnalyzingPdf || isSubmitting}
            >
              {isAnalyzingPdf ? "Analyzing PDF..." : "Analyze PDF with AI"}
            </Button>
          )}
          {pdfFile && metadataMode === "manual" && (
            <p className="text-xs text-gray-500 mt-2">
              Manual mode is active. Enter composition details in the form.
            </p>
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
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Uploading..." : "Upload Composition"}
        </Button>
      </div>
    </form>
  );
}
