import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
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
import { categoryService, mediaService } from "@/services/api";
import {
  parseAccompanimentList,
  stringifyAccompanimentList,
} from "@/lib/compositionMeta";
import { toast } from "sonner";

interface UploadCompositionProps {
  onClose: () => void;
  defaultCategoryName?: "arrangements" | "compositions";
  entryLabel?: string;
}

interface AnalyzedCompositionMetadata {
  title?: string;
  description?: string;
  duration?: string;
  language?: string;
  accompaniment?: string | string[];
  voiceParts?: string[];
}

interface CompositionBackgroundItem {
  id: number;
  alt?: string;
  photographer?: string;
  src: {
    original?: string | null;
    large2x?: string | null;
    large?: string | null;
    landscape?: string | null;
    medium?: string | null;
    portrait?: string | null;
    small?: string | null;
  };
}

interface CompositionCategory {
  id: number;
  name: string;
  description?: string | null;
}

const ALLOWED_CATEGORY_NAMES = new Set(["arrangements", "compositions"]);
const MIDI_ACCEPT =
  ".mid,.midi,audio/midi,audio/x-midi,audio/mid,application/x-midi";
const MIDI_MIME_TYPES = new Set([
  "audio/midi",
  "audio/x-midi",
  "audio/mid",
  "application/x-midi",
]);

function isAllowedCategory(category: Partial<CompositionCategory> | null | undefined) {
  return ALLOWED_CATEGORY_NAMES.has(String(category?.name || "").trim().toLowerCase());
}

type MetadataMode = "ai" | "manual" | null;
type SelectOrOther = string;
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
];

export function UploadComposition({
  onClose,
  defaultCategoryName,
  entryLabel: entryLabelProp,
}: UploadCompositionProps) {
  const normalizedDefaultCategory = (defaultCategoryName || "").toLowerCase();
  const isArrangement = normalizedDefaultCategory === "arrangements";
  const entryLabel = (defaultCategoryName
    ? isArrangement
      ? "Arrangement"
      : "Composition"
    : entryLabelProp || "Composition").trim();
  const entryLabelLower = entryLabel.toLowerCase();
  const [formData, setFormData] = useState({
    title: "",
    categoryId: "",
    price: "",
    description: "",
    duration: "",
    language: "" as SelectOrOther,
    customLanguage: "",
    accompaniments: [] as string[],
    customAccompaniment: "",
    voiceParts: [] as string[],
    customVoicePart: "",
  });

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [midiFile, setMidiFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [metadataMode, setMetadataMode] = useState<MetadataMode>(null);
  const [analysisAttempted, setAnalysisAttempted] = useState(false);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const [isFreeDownload, setIsFreeDownload] = useState(false);
  const [backgroundPrompt, setBackgroundPrompt] = useState("");
  const [backgroundCandidates, setBackgroundCandidates] = useState<
    CompositionBackgroundItem[]
  >([]);
  const [selectedBackgroundUrl, setSelectedBackgroundUrl] = useState("");
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);
  const [categories, setCategories] = useState<CompositionCategory[]>([]);
  const [isCategoryLocked, setIsCategoryLocked] = useState(false);

  const voicePartOptions = [
    "Soprano",
    "Alto",
    "Tenor",
    "Bass",
    "Soprano I",
    "Soprano II",
  ];

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      try {
        const payload = await categoryService.getAll();
        if (!mounted) return;
        const filtered = (Array.isArray(payload) ? payload : []).filter(
          isAllowedCategory,
        );
        setCategories(filtered);

        if (!normalizedDefaultCategory || formData.categoryId) return;
        const match = filtered.find(
          (category) =>
            String(category?.name || "").trim().toLowerCase() ===
            normalizedDefaultCategory,
        );
        if (match) {
          setFormData((prev) => ({
            ...prev,
            categoryId: String(match.id),
          }));
          setIsCategoryLocked(true);
        }
      } catch (error) {
        console.error("[UploadComposition] failed to load categories:", error);
      }
    };

    void loadCategories();
    return () => {
      mounted = false;
    };
  }, [formData.categoryId, normalizedDefaultCategory]);

  const resolveCustomOrPreset = (
    selectedValue: SelectOrOther,
    customValue: string,
  ) => {
    if (selectedValue === "Other") return customValue.trim();
    return selectedValue.trim();
  };

  const resolvedLanguage = resolveCustomOrPreset(
    formData.language,
    formData.customLanguage,
  );
  const resolvedAccompaniment = stringifyAccompanimentList([
    ...formData.accompaniments,
    formData.customAccompaniment,
  ]);
  const isAiMode = metadataMode === "ai";
  const isManualMode = metadataMode === "manual";
  const shouldShowMetadataFields =
    isManualMode || (isAiMode && (analysisAttempted || analysisFailed));

  const getBackgroundImageUrl = (item?: CompositionBackgroundItem | null) =>
    item?.src?.landscape ||
    item?.src?.large ||
    item?.src?.large2x ||
    item?.src?.medium ||
    item?.src?.original ||
    "";

  const isMidiFile = (file: File) => {
    const mime = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();
    const hasMidiExtension = name.endsWith(".mid") || name.endsWith(".midi");
    if (MIDI_MIME_TYPES.has(mime)) return true;
    if (mime === "application/octet-stream") return hasMidiExtension;
    return hasMidiExtension;
  };

  const missingRequiredFields: string[] = [];
  if (!formData.title.trim()) missingRequiredFields.push("Title");
  if (!formData.description.trim()) missingRequiredFields.push("Description");
  if (!isFreeDownload && !formData.price.trim()) {
    missingRequiredFields.push("Price");
  }
  if (!formData.duration.trim()) missingRequiredFields.push("Duration");
  if (!resolvedLanguage) missingRequiredFields.push("Language");
  if (!resolvedAccompaniment) missingRequiredFields.push("Accompaniment");
  if (formData.voiceParts.length === 0) {
    missingRequiredFields.push("At least one voice part");
  }
  if (!pdfFile) missingRequiredFields.push("PDF score");
  if (!midiFile) missingRequiredFields.push("MIDI preview file");

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

  const handleAccompanimentToggle = (part: string) => {
    setFormData((prev) => ({
      ...prev,
      accompaniments: prev.accompaniments.includes(part)
        ? prev.accompaniments.filter((item) => item !== part)
        : [...prev.accompaniments, part],
    }));
  };

  const handleAddCustomAccompaniment = () => {
    const nextValue = formData.customAccompaniment.trim();
    if (!nextValue) return;

    const existing = stringifyAccompanimentList([
      ...formData.accompaniments,
      nextValue,
    ]);
    if (!existing) return;

    setFormData((prev) => ({
      ...prev,
      accompaniments: parseAccompanimentList([
        ...prev.accompaniments,
        prev.customAccompaniment,
      ]),
      customAccompaniment: "",
    }));
  };

  const handleRemoveAccompaniment = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      accompaniments: prev.accompaniments.filter((item) => item !== value),
    }));
  };

  const applyAnalyzedMetadata = (metadata: AnalyzedCompositionMetadata) => {
    const detectedLanguage = metadata.language || "";
    const detectedAccompaniments = parseAccompanimentList(metadata.accompaniment);
    const isKnownLanguage = LANGUAGE_OPTIONS
      .filter((item) => item !== "Other")
      .some((item) => item.toLowerCase() === detectedLanguage.toLowerCase());

    setFormData((prev) => ({
      ...prev,
      title: prev.title || metadata.title || "",
      description: prev.description || metadata.description || "",
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
      accompaniments:
        prev.accompaniments.length > 0
          ? prev.accompaniments
          : detectedAccompaniments,
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
      setAnalysisAttempted(false);
      setAnalysisFailed(false);

      const token = await getFreshAccessToken();
      if (!token) {
        toast.error("Not authenticated for PDF analysis");
        setAnalysisFailed(true);
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
        setAnalysisFailed(true);
        return;
      }

      const result = await response.json();
      if (!result?.success || !result?.metadata) {
        toast.error("PDF analysis returned no metadata");
        setAnalysisFailed(true);
        return;
      }

      applyAnalyzedMetadata(result.metadata);
      toast.success("PDF analyzed. Review suggested fields.");
      setAnalysisAttempted(true);
    } catch (error) {
      console.error("Error analyzing PDF:", error);
      toast.error("Could not analyze this PDF automatically");
      setAnalysisFailed(true);
    } finally {
      setIsAnalyzingPdf(false);
    }
  };

  const generateMarketingBackground = async (options?: {
    silent?: boolean;
    autoSelect?: boolean;
  }): Promise<string | null> => {
    const title = formData.title.trim();
    if (!title) {
      if (!options?.silent) {
        toast.error(`Enter a ${entryLabelLower} title first`);
      }
      return null;
    }

    try {
      setIsGeneratingBackground(true);
      const payload = await mediaService.getCompositionBackground({
        title,
        description: formData.description.trim() || undefined,
        language: resolvedLanguage || undefined,
        accompaniment: resolvedAccompaniment || undefined,
        voiceParts: formData.voiceParts,
        perPage: 9,
      });

      const candidates = Array.isArray(payload?.items) ? payload.items : [];
      setBackgroundPrompt(payload?.shortDescription || "");
      setBackgroundCandidates(candidates);

      if (candidates.length === 0) {
        if (!options?.silent) {
          toast.error(
            payload?.warning ||
              "No Pexels background found. Try editing title or description.",
          );
        }
        return null;
      }

      const topUrl = getBackgroundImageUrl(candidates[0]);
      let nextSelectedUrl = selectedBackgroundUrl;
      if (options?.autoSelect || !nextSelectedUrl) {
        nextSelectedUrl = topUrl || "";
        if (nextSelectedUrl) {
          setSelectedBackgroundUrl(nextSelectedUrl);
        }
      }

      if (!options?.silent) {
        toast.success("Marketing-friendly backgrounds generated");
      }
      return nextSelectedUrl || topUrl || null;
    } catch (error) {
      console.error("[UploadComposition] background generation failed:", error);
      if (!options?.silent) {
        toast.error("Failed to generate marketing background");
      }
      return null;
    } finally {
      setIsGeneratingBackground(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setUploadProgress(0);
      setAnalysisAttempted(false);
      setAnalysisFailed(false);
      toast.success("PDF file selected successfully");
      if (isAiMode) {
        void analyzePdf(file);
      }
    } else {
      toast.error("Please select a valid PDF file");
    }
  };

  const handleMidiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isMidiFile(file)) {
      setMidiFile(file);
      toast.success("MIDI file selected successfully");
    } else {
      toast.error("Please select a valid MIDI file (.mid or .midi)");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!metadataMode) {
        toast.error("Select AI Analyze or Manual Fill to continue");
        setIsSubmitting(false);
        return;
      }

      if (isAiMode && !analysisAttempted && !analysisFailed) {
        toast.error("Upload a PDF and wait for AI analysis first");
        setIsSubmitting(false);
        return;
      }

      let parsedPrice = Number.parseFloat(formData.price);
      const finalCurrency = "KES";

      if (!formData.title || !formData.description.trim()) {
        toast.error("Please fill in title and description");
        setIsSubmitting(false);
        return;
      }

      if (isFreeDownload) {
        parsedPrice = 0;
      } else if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        toast.error("Please enter a valid positive price");
        setIsSubmitting(false);
        return;
      }

      if (!resolvedLanguage || !resolvedAccompaniment) {
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
      let midiUrl = "";

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
        setUploadProgress(55);
      } else {
        toast.error("Please select a PDF file");
        setIsSubmitting(false);
        return;
      }

      // Step 1b: Upload MIDI preview to Supabase storage bucket
      if (midiFile) {
        const midiFormData = new FormData();
        midiFormData.append("file", midiFile);

        const midiUploadResponse = await fetch(
          `${API_BASE_URL}/upload/compositions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: midiFormData,
          },
        );

        if (!midiUploadResponse.ok) {
          let errorData: any = {};
          try {
            errorData = await midiUploadResponse.json();
          } catch {
            // ignore parse errors
          }
          const uploadMessage =
            errorData?.message ||
            errorData?.error ||
            errorData?.details ||
            `Upload failed (${midiUploadResponse.status})`;
          console.error("[UploadComposition] midi upload failed", {
            status: midiUploadResponse.status,
            body: errorData,
          });
          throw new Error(uploadMessage);
        }

        const midiUploadData = await midiUploadResponse.json();
        midiUrl = midiUploadData.url;
        setUploadProgress(100);
      } else {
        toast.error("Please select a MIDI file");
        setIsSubmitting(false);
        return;
      }

      let thumbnailUrl = selectedBackgroundUrl.trim();
      if (!thumbnailUrl) {
        const generatedUrl = await generateMarketingBackground({
          silent: true,
          autoSelect: true,
        });
        if (generatedUrl) {
          thumbnailUrl = generatedUrl;
        }
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
          category_id: formData.categoryId
            ? Number.parseInt(formData.categoryId, 10)
            : null,
          price: parsedPrice,
          price_currency: finalCurrency,
          difficulty: null,
          duration: formData.duration || null,
          language: resolvedLanguage,
          accompaniment: parseAccompanimentList([
            ...formData.accompaniments,
            formData.customAccompaniment,
          ]),
          voice_parts:
            formData.voiceParts.length > 0 ? formData.voiceParts : null,
          pdf_url: pdfUrl,
          midi_url: midiUrl,
          thumbnail_url: thumbnailUrl || null,
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
            category_id: formData.categoryId || null,
            price: formData.price,
            price_currency: finalCurrency,
            difficulty: null,
            language: resolvedLanguage,
            accompaniment: parseAccompanimentList([
              ...formData.accompaniments,
              formData.customAccompaniment,
            ]),
            hasPdfUrl: Boolean(pdfUrl),
            hasMidiUrl: Boolean(midiUrl),
          },
        });
        throw new Error(errorMessage);
      }

      toast.success(`${entryLabel} uploaded successfully!`);
      setIsSuccess(true);

      // Close after success
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error uploading composition:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to upload ${entryLabelLower}`,
      );
      setIsSubmitting(false);
    }
  };

  const renderPdfUploadSection = () => (
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
          disabled={isSubmitting}
        />
        {pdfFile && (
          <p className="mt-2 text-sm text-gray-600">Selected: {pdfFile.name}</p>
        )}

        {isAiMode && isAnalyzingPdf && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-primary">
              <Loader2 className="size-4 animate-spin" />
              Analyzing your PDF...
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Extracting title, language, accompaniment, and voice parts.
            </p>
          </div>
        )}

        {pdfFile && isAiMode && !isAnalyzingPdf && (
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() => void analyzePdf(pdfFile)}
            disabled={isSubmitting}
          >
            {analysisAttempted ? "Re-analyze PDF" : "Analyze PDF with AI"}
          </Button>
        )}

        {pdfFile && isManualMode && (
          <p className="mt-2 text-xs text-gray-500">
            Manual mode is active. Enter composition details below.
          </p>
        )}

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );

  const renderMidiUploadSection = () => (
    <div>
      <Label htmlFor="midi-file">MIDI Preview File *</Label>
      <div className="mt-2">
        <Input
          id="midi-file"
          type="file"
          accept={MIDI_ACCEPT}
          onChange={handleMidiChange}
          className="cursor-pointer"
          disabled={isSubmitting}
        />
        {midiFile && (
          <p className="mt-2 text-sm text-gray-600">Selected: {midiFile.name}</p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Upload a MIDI file so buyers can preview a short sample before download.
        </p>
      </div>
    </div>
  );

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CheckCircle className="size-16 text-green-600 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Upload Successful!</h3>
        <p className="text-gray-600">
          Your {entryLabelLower} has been added to the marketplace.
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
            onClick={() => {
              setMetadataMode("ai");
              if (pdfFile) {
                void analyzePdf(pdfFile);
              }
            }}
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
            : metadataMode === "manual"
              ? "Fill all required details manually. PDF analysis will not run automatically."
              : "Choose one option to begin your upload flow."}
        </p>
      </div>

      {metadataMode === null && (
        <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
          Select an upload option above to continue.
        </div>
      )}

      {isAiMode && (
        <>
          <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            Step 2: Upload your PDF score and MIDI preview file. AI analysis will run automatically.
          </div>
          {renderPdfUploadSection()}
          {renderMidiUploadSection()}

          {analysisFailed && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              AI analysis failed. Fill the required fields manually below.
            </div>
          )}

          {analysisAttempted && missingRequiredFields.length > 0 && (
            <div className="rounded-lg border border-border/70 bg-card/60 p-3 text-sm">
              <p className="font-medium text-foreground">
                Complete required details before upload:
              </p>
              <p className="mt-1 text-muted-foreground">
                {missingRequiredFields.join(", ")}
              </p>
            </div>
          )}
        </>
      )}

      {shouldShowMetadataFields && (
        <>
      {/* Title */}
      <div>
      <Label htmlFor="title">{entryLabel} Title *</Label>
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
      <Label htmlFor="description">{entryLabel} Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder={`Describe your ${entryLabelLower}, its mood, suitable occasions...`}
          rows={4}
          required
        />
      </div>

      <div>
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.categoryId}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, categoryId: value }))
          }
          disabled={isCategoryLocked}
        >
          <SelectTrigger id="category">
            <SelectValue placeholder="Select a category (optional)" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-xs text-gray-600">
          {isCategoryLocked
            ? `This upload is tagged as a ${entryLabelLower}.`
            : "Choose whether this upload is an arrangement or an original composition."}
        </p>
      </div>

      {/* Marketing Background */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Marketing Background (AI + Pexels)</Label>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void generateMarketingBackground({ silent: false, autoSelect: true })
            }
            disabled={isSubmitting || isGeneratingBackground || !formData.title.trim()}
          >
            {isGeneratingBackground ? "Generating..." : "Generate Background"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Uses your title and description to generate a short visual prompt, then
          searches Pexels for marketing-friendly composition artwork.
        </p>
        {backgroundPrompt && (
          <p className="mt-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            AI visual brief: {backgroundPrompt}
          </p>
        )}

        {selectedBackgroundUrl ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-border/70 bg-muted/20">
            <img
              src={selectedBackgroundUrl}
              alt="Selected composition background"
              className="h-40 w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
            No background selected yet. Generate one for better marketplace
            presentation.
          </div>
        )}

        {backgroundCandidates.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {backgroundCandidates.map((item) => {
              const imageUrl = getBackgroundImageUrl(item);
              if (!imageUrl) return null;
              const isActive = selectedBackgroundUrl === imageUrl;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`overflow-hidden rounded-md border transition ${
                    isActive
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border/70 hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedBackgroundUrl(imageUrl)}
                >
                  <img
                    src={imageUrl}
                    alt={item.alt || "Pexels composition background option"}
                    className="h-24 w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Price */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label>Price *</Label>
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
            <Checkbox
              id="free-download"
              checked={isFreeDownload}
              onCheckedChange={(checked) => {
                const nextValue = Boolean(checked);
                setIsFreeDownload(nextValue);
                setFormData((prev) => ({
                  ...prev,
                  price: nextValue ? "0" : prev.price === "0" ? "" : prev.price,
                }));
              }}
            />
            <Label htmlFor="free-download" className="cursor-pointer text-xs">
              Offer as free download
            </Label>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="flex items-center rounded-md border border-border/70 bg-muted/30 px-3 text-sm font-medium text-foreground">
            Kenyan Shilling (KES)
          </div>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={formData.price}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, price: e.target.value }))
            }
            placeholder={isFreeDownload ? "0" : "e.g., 3500"}
            required={!isFreeDownload}
            disabled={isFreeDownload}
          />
        </div>
        <p className="mt-2 text-xs text-gray-600">
          {isFreeDownload
            ? "This upload will be listed as free for buyers."
            : "All composition prices are entered and stored in Kenyan Shilling (KES)."}
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
        <Label>Accompaniment *</Label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {ACCOMPANIMENT_OPTIONS.map((part) => (
            <div key={part} className="flex items-center space-x-2">
              <Checkbox
                id={`accompaniment-${part}`}
                checked={formData.accompaniments.includes(part)}
                onCheckedChange={() => handleAccompanimentToggle(part)}
              />
              <label
                htmlFor={`accompaniment-${part}`}
                className="cursor-pointer text-sm"
              >
                {part}
              </label>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            value={formData.customAccompaniment}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                customAccompaniment: e.target.value,
              }))
            }
            placeholder="Add custom accompaniment"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddCustomAccompaniment}
            disabled={!formData.customAccompaniment.trim()}
          >
            Add
          </Button>
        </div>
        {formData.accompaniments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {formData.accompaniments.map((part) => (
              <button
                key={part}
                type="button"
                className="rounded-full border border-border bg-muted px-3 py-1 text-xs hover:bg-muted/80"
                onClick={() => handleRemoveAccompaniment(part)}
              >
                {part} x
              </button>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {isManualMode && (
        <>
          <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            Step 2: Upload your PDF score and MIDI preview file.
          </div>
          {renderPdfUploadSection()}
          {renderMidiUploadSection()}
        </>
      )}

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
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            !metadataMode ||
            isAnalyzingPdf ||
            (isAiMode && !shouldShowMetadataFields)
          }
          className="flex-1"
        >
          {isSubmitting ? "Uploading..." : `Upload ${entryLabel}`}
        </Button>
      </div>
    </form>
  );
}

