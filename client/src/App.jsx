// App.jsx
import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import CompanyTable from "./components/CompanyTable";

function App() {
  const [data, setData] = useState([]);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>PDF Company Extractor</h1>
      <FileUpload onData={setData} />
      <CompanyTable data={data} />
    </div>
  );
}

export default App;
