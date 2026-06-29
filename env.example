export const escapeCsvValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // If the value contains quotes, commas, or line breaks, enclose it in quotes and escape internal quotes
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const convertRowsToCsv = (rows: Record<string, any>[]): string => {
  if (!rows || rows.length === 0) return '';
  
  // Extract headers
  const headers = Object.keys(rows[0]);
  const headerRow = headers.map(escapeCsvValue).join(',');

  // Extract rows
  const dataRows = rows.map(row => 
    headers.map(header => escapeCsvValue(row[header])).join(',')
  ).join('\n');

  return `${headerRow}\n${dataRows}`;
};

export const downloadCsv = (filename: string, rows: Record<string, any>[]) => {
  if (!rows || rows.length === 0) {
    alert('No records available to export yet.');
    return;
  }
  
  const csvContent = convertRowsToCsv(rows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
};

export const sanitizeFilename = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};
