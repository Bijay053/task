import { useRef, useState } from "react";
import { useBulkUpload } from "@workspace/api-client-react";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button, Modal } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface BulkUploadButtonProps {
  department: "gs" | "offer";
  onSuccess?: () => void;
}

export function BulkUploadButton({ department, onSuccess }: BulkUploadButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [resultModal, setResultModal] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const queryClient = useQueryClient();
  const uploadMut = useBulkUpload();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadMut.mutateAsync({ department, file });
      setResult(res);
      setResultModal(true);
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      onSuccess?.();
    } catch (err: any) {
      setResult({ created: 0, skipped: 0, errors: [err?.message || "Upload failed"] });
      setResultModal(true);
    }
    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        isLoading={uploadMut.isPending}
      >
        <Upload className="w-4 h-4 mr-2" />
        Upload Excel
      </Button>

      <Modal
        isOpen={resultModal}
        onClose={() => setResultModal(false)}
        title="Bulk Upload Result"
        maxWidth="max-w-lg"
      >
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
                <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
                <div>
                  <div className="text-2xl font-bold text-green-700">{result.created}</div>
                  <div className="text-sm text-green-600">Rows imported</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle className="w-8 h-8 text-amber-600 shrink-0" />
                <div>
                  <div className="text-2xl font-bold text-amber-700">{result.skipped}</div>
                  <div className="text-sm text-amber-600">Rows skipped</div>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 max-h-48 overflow-y-auto">
                <p className="text-sm font-semibold text-red-700 mb-2">Errors / Warnings:</p>
                <ul className="space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-600 flex gap-2">
                      <X className="w-3 h-3 shrink-0 mt-0.5" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl bg-muted/50 p-4 text-sm">
              <p className="font-semibold mb-2">Expected Excel columns:</p>
              {department === "gs" ? (
                <p className="text-muted-foreground text-xs">Student Name | Country | University | Course | Intake | Status | Agent Email | Submitted Date | Verification | Remarks</p>
              ) : (
                <p className="text-muted-foreground text-xs">Student Name | University | Course | Intake | Channel | Status | Agent Email | Offer Applied Date | Offer Received Date | Remarks</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setResultModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
