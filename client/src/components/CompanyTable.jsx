import React from "react";

function CompanyTable({ data }) {
  if (!data.length) return null;

  return (
    <table
      border="1"
      cellPadding="8"
      style={{ marginTop: "20px", width: "100%" }}
    >
      <thead>
        <tr>
          <th>#</th>
          <th>Company</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Address</th>
        </tr>
      </thead>
      <tbody>
        {data.map((entry, index) => (
          <tr key={index}>
            <td>{index + 1}</td>
            <td>{entry.company}</td>
            <td>{entry.email}</td>
            <td>{entry.phone}</td>
            <td>{entry.address}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default CompanyTable;
