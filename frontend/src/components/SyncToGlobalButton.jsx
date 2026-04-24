import { useState } from "react";
import { API_BASE_URL, getAuthToken } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const SYNC_SESSION_KEY = "sync_to_global_session_id";

export function SyncToGlobalButton() {
  const { selectedStore } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resumableSessionId, setResumableSessionId] = useState(() =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem(SYNC_SESSION_KEY) : null
  );

  const startStream = (sessionIdParam = null) => {
    const storeId = selectedStore?.id ?? selectedStore?._id ?? selectedStore?.storeId;
    if (!storeId) {
      alert("❌ Please select a store first");
      return;
    }

    setSyncing(true);
    setProgress(0);
    if (!sessionIdParam) sessionStorage.removeItem(SYNC_SESSION_KEY);

    const base = API_BASE_URL.startsWith("http")
      ? API_BASE_URL
      : `${window.location.origin}${API_BASE_URL.startsWith("/") ? "" : "/"}${API_BASE_URL}`;
    let streamUrl = `${base.replace(/\/+$/, "")}/sync-to-global/stream`;
    const token = getAuthToken();
    const params = new URLSearchParams();
    if (token) params.set("token", token);
    if (sessionIdParam) params.set("session_id", sessionIdParam);
    if (params.toString()) streamUrl += `?${params.toString()}`;

    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.progress === "number") setProgress(data.progress);
        if (data.sessionId != null) {
          sessionStorage.setItem(SYNC_SESSION_KEY, String(data.sessionId));
          setResumableSessionId(String(data.sessionId));
        }
        if (data.status === "success") {
          eventSource.close();
          setSyncing(false);
          sessionStorage.removeItem(SYNC_SESSION_KEY);
          setResumableSessionId(null);
          const msg = data.message || "Tables updated in global SQL.";
          const detail =
            data.insertedRecords != null || data.updatedRecords != null
              ? ` Inserted: ${data.insertedRecords ?? 0}, Updated: ${data.updatedRecords ?? 0}.`
              : "";
          alert(`✅ ${msg}${detail}`);
        } else if (data.status === "error") {
          eventSource.close();
          setSyncing(false);
          sessionStorage.removeItem(SYNC_SESSION_KEY);
          setResumableSessionId(null);
          alert(`❌ Backup failed: ${data.message || "Unknown error"}`);
        } else if (data.status === "cancelled") {
          eventSource.close();
          setSyncing(false);
          alert("⚠️ Sync cancelled.");
        }
      } catch (e) {
        console.error("Parse SSE data:", e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setSyncing(false);
      if (resumableSessionId || sessionStorage.getItem(SYNC_SESSION_KEY)) {
        setResumableSessionId(sessionStorage.getItem(SYNC_SESSION_KEY));
        alert("Connection lost. Data synced so far is saved. When the internet is back, click \"Resume sync\" to continue.");
      } else {
        alert("❌ Backup failed: connection lost. Check server and global DB config.");
      }
    };
  };

  const handleStart = () => startStream(null);
  const handleResume = () => startStream(resumableSessionId || sessionStorage.getItem(SYNC_SESSION_KEY));

  return (
    <span style={{ display: "inline-flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <Button onClick={handleStart} disabled={syncing}>
        {syncing ? `Backup & sync… ${progress}%` : "Synchronize"}
      </Button>
      {(resumableSessionId || (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SYNC_SESSION_KEY))) && !syncing && (
        <Button variant="outline" onClick={handleResume}>
          Resume sync
        </Button>
      )}
    </span>
  );
}

