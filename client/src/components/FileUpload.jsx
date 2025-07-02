import React, { useState } from "react";
import axios from "axios";

function FileUpload({ onData }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("pdf", file);

    setLoading(true);
    try {
      const res = await axios.post("https://boothexpo.onrender.com", formData);
      onData(res.data.enrichedData);
    } catch (err) {
      alert("Error uploading file");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="upload-form">
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Processing..." : "Upload PDF"}
      </button>
      <p>Estimated time to process a file 1-2 minutes</p>
    </form>
  );
}

export default FileUpload;
