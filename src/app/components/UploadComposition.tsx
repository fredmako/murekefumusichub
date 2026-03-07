import { useState } from "react";
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
import { compositionService, mediaService } from "@/services/api";
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

type MetadataMode = "ai" | "manual" | null;
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
  const [metadataMode, setMetadataMode] = useState<MetadataMode>(null);
  const [analysisAttempted, setAnalysisAttempted] = useState(false);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const [backgroundPrompt, setBackgroundPrompt] = useState("");
  const [backgroundCandidates, setBackgroundCandidates] = useState<
    CompositionBackgroundItem[]
  >([]);
  const [selectedBackgroundUrl, setSelectedBackgroundUrl] = useState("");
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);
  const [isConvertingPrice, setIsConvertingPrice] = useState(false);
  const [priceConversion, setPriceConversion] = useState<{
    originalAmount: number;
    originalCurrency: string;
    usdAmount: number;
    rateToUsd: number;
    detectedBy: "ai" | "heuristic";
  } | null>(null);

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

  const missingRequiredFields: string[] = [];
  if (!formData.title.trim()) missingRequiredFields.push("Title");
  if (!formData.description.trim()) missingRequiredFields.push("Description");
  if (!formData.price.trim()) missingRequiredFields.push("Price");
  if (!resolvedCurrency) missingRequiredFields.push("Currency");
  if (!resolvedDifficulty) missingRequiredFields.push("Difficulty");
  if (!formData.duration.trim()) missingRequiredFields.push("Duration");
  if (!resolvedLanguage) missingRequiredFields.push("Language");
  if (!resolvedAccompaniment) missingRequiredFields.push("Accompaniment");
  if (formData.voiceParts.length === 0) {
    missingRequiredFields.push("At least one voice part");
  }
  if (!pdfFile) missingRequiredFields.push("PDF score");

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
        toast.error("Enter a composition title first");
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

  const convertCurrentPriceToUsd = async (options?: { silent?: boolean }) => {
    const rawPriceInput = formData.price.trim();
    const currencyHint = resolveCustomOrPreset(
      formData.currency,
      formData.customCurrency,
    );

    if (!rawPriceInput && !currencyHint) {
      if (!options?.silent) {
        toast.error("Enter a price first");
      }
      return null;
    }

    try {
      setIsConvertingPrice(true);
      const converted = await compositionService.convertPriceToUsd({
        priceInput: rawPriceInput,
        currencyHint: currencyHint || undefined,
      });

      setPriceConversion({
        originalAmount: Number(converted.originalAmount || 0),
        originalCurrency: String(converted.originalCurrency || "USD"),
        usdAmount: Number(converted.usdAmount || 0),
        rateToUsd: Number(converted.rateToUsd || 1),
        detectedBy: converted.detectedBy || "heuristic",
      });

      setFormData((prev) => ({
        ...prev,
        price: Number(converted.usdAmount || 0).toFixed(2),
        currency: "USD",
        customCurrency: "",
      }));

      if (!options?.silent) {
        toast.success(
          `Converted to USD $${Number(converted.usdAmount || 0).toFixed(2)}`,
        );
      }
      return converted;
    } catch (error) {
      console.error("[UploadComposition] price conversion failed:", error);
      if (!options?.silent) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to detect/convert price to USD",
        );
      }
      return null;
    } finally {
      setIsConvertingPrice(false);
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

      // Validate and normalize price to USD
      let parsedPrice = Number.parseFloat(formData.price);
      let finalCurrency = resolvedCurrency || "USD";
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0 || finalCurrency !== "USD") {
        const converted = await convertCurrentPriceToUsd({ silent: true });
        if (!converted) {
          toast.error(
            "Could not detect and convert the entered price to USD. Use a format like 'KES 3500', '€25', or select currency then convert.",
          );
          setIsSubmitting(false);
          return;
        }
        parsedPrice = Number(converted.usdAmount || 0);
        finalCurrency = "USD";
      }

      if (!formData.title || !formData.description.trim()) {
        toast.error("Please fill in title and description");
        setIsSubmitting(false);
        return;
      }

      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        toast.error("Please enter a valid positive price");
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
          price: parsedPrice,
          price_currency: finalCurrency,
          difficulty: resolvedDifficulty,
          duration: formData.duration || null,
          language: resolvedLanguage,
          accompaniment: resolvedAccompaniment,
          voice_parts:
            formData.voiceParts.length > 0 ? formData.voiceParts : null,
          pdf_url: pdfUrl,
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
            price: formData.price,
            price_currency: finalCurrency,
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
              Extracting title, difficulty, language, accompaniment, and voice parts.
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
            Step 2: Upload your PDF score. AI analysis will run automatically.
          </div>
          {renderPdfUploadSection()}

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
        <Label>Price *</Label>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Select
              value={formData.currency}
              onValueChange={(value) =>
                {
                  setPriceConversion(null);
                  setFormData((prev) => ({
                    ...prev,
                    currency: value,
                    customCurrency: value === "Other" ? prev.customCurrency : "",
                  }));
                }
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
              type="text"
              value={formData.price}
              onChange={(e) => {
                setPriceConversion(null);
                setFormData((prev) => ({ ...prev, price: e.target.value }));
              }}
              placeholder={
                formData.currency === "KES"
                  ? "e.g., 3500 or KES 3500"
                  : formData.currency === "EUR"
                    ? "e.g., 25.00 or EUR 25"
                    : "e.g., 29.99 or USD 29.99"
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
              {
                setPriceConversion(null);
                setFormData((prev) => ({
                  ...prev,
                  customCurrency: e.target.value.toUpperCase(),
                }));
              }
            }
            placeholder="Enter currency code or name (e.g., GBP)"
            required
          />
        )}
        <p className="mt-2 text-xs text-gray-600">
          Enter amount with or without currency code. Example: KES 3500, €25,
          USD 29.99.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void convertCurrentPriceToUsd({ silent: false })}
            disabled={isSubmitting || isConvertingPrice || !formData.price.trim()}
          >
            {isConvertingPrice ? "Converting..." : "AI Detect & Convert to USD"}
          </Button>
          {priceConversion && (
            <span className="text-xs text-muted-foreground">
              {priceConversion.detectedBy === "ai" ? "AI" : "Rule"} detected{" "}
              {priceConversion.originalCurrency} {priceConversion.originalAmount.toFixed(2)}{" "}
              {"->"} USD {priceConversion.usdAmount.toFixed(2)}
            </span>
          )}
        </div>
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
        </>
      )}

      {isManualMode && (
        <>
          <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            Step 2: Upload your PDF score.
          </div>
          {renderPdfUploadSection()}
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
          {isSubmitting ? "Uploading..." : "Upload Composition"}
        </Button>
      </div>
    </form>
  );
}
