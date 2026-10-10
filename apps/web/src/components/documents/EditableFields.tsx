"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";

type Props = {
  documentId: string;
  extractionId: string;
  initialFields: Record<string, unknown>;
};

export function EditableFields({ documentId, extractionId, initialFields }: Props) {
  const [fields, setFields] = useState<Record<string, unknown>>(initialFields);
  const [editing, setEditing] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveField(key: string) {
    setSaving(true);
    const newFields = { ...fields, [key]: tempValue };

    const supabase = createClient();
    const { error } = await supabase
      .from("extractions")
      .update({ extracted_fields: newFields })
      .eq("id", extractionId);

    if (error) {
      alert("❌ " + error.message);
    } else {
      setFields(newFields);
      setEditing(null);
    }
    setSaving(false);
  }

  return (
    <Card className="p-4">
      <h2 className="font-semibold mb-3">🤖 Champs extraits (éditables)</h2>
      <dl className="text-sm space-y-2">
        {Object.entries(fields).map(([key, value]) => {
          if (key === "line_items") return null;
          const isEditing = editing === key;

          return (
            <div key={key} className="flex justify-between items-center gap-4 py-1">
              <dt className="text-gray-500 font-mono text-xs">{key}</dt>
              <dd className="flex items-center gap-2 flex-1 justify-end">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      className="border rounded px-2 py-1 text-sm flex-1 max-w-xs"
                      autoFocus
                    />
                    <button
                      onClick={() => saveField(key)}
                      disabled={saving}
                      className="text-green-600 hover:text-green-800 text-xs"
                    >
                      ✅
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="text-gray-400 hover:text-gray-600 text-xs"
                    >
                      ❌
                    </button>
                  </>
                ) : (
                  <>
                    <span className="break-all text-right">
                      {value == null ? (
                        <span className="text-red-500">null</span>
                      ) : (
                        String(value)
                      )}
                    </span>
                    <button
                      onClick={() => {
                        setEditing(key);
                        setTempValue(String(value ?? ""));
                      }}
                      className="text-blue-500 hover:text-blue-700 text-xs"
                      title="Éditer"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}