import React, { useState } from "react";
import { parseNaturalLanguageTask, taskApi } from "../taskAPI";

export default function NaturalLanguageInput({ onTaskCreated }) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini"); // "gemini" or "grok"
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      // 1. Call chosen AI model (gemini or grok)
      const parsedData = await parseNaturalLanguageTask(prompt, selectedModel);

      // 2. Save the task
      const newTask = await taskApi.create(parsedData);

      if (onTaskCreated) onTaskCreated(newTask);
      setPrompt("");
    } catch (err) {
      alert(`Error with ${selectedModel === "gemini" ? "Gemini" : "Grok"}: ` + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: "20px", background: "#f9fafb", padding: "12px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        
        {/* Model Selection Dropdown */}
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            fontWeight: "600",
            backgroundColor: selectedModel === "gemini" ? "#eff6ff" : "#f4f4f5",
            color: selectedModel === "gemini" ? "#1d4ed8" : "#18181b",
            cursor: "pointer"
          }}
        >
          <option value="gemini">✨ Gemini 1.5</option>
          <option value="grok">🤖 Grok Beta</option>
        </select>

        {/* Input Bar */}
        <input
          type="text"
          placeholder={`Describe task for ${selectedModel === "gemini" ? "Gemini" : "Grok"} (e.g. 'Pay electricity bill on Friday 6pm high priority')...`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            fontSize: "14px",
          }}
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            backgroundColor: selectedModel === "gemini" ? "#2563eb" : "#09090b",
            color: "#fff",
            border: "none",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Thinking..." : "Create Task"}
        </button>
      </form>
    </div>
  );
}