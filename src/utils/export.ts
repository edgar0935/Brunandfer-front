import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface Row {
  nombre: string;
  cantidad: number;
  ubicacion?: string;
}

// ===== PDF =====
export function exportInventarioPDF(rows: Row[], title = 'Inventario General') {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(title, 14, 22);

  const body = rows.map((r) => [
    r.nombre,
    (Number.isFinite(r.cantidad) ? r.cantidad : 0).toLocaleString(),
    r.ubicacion?.trim() || 'Sin asignar',
  ]);

  autoTable(doc, {
    head: [['Artículo', 'Cantidad', 'Ubicación']],
    body,
    startY: 30,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [199, 0, 0] },
  });

  doc.save('inventario.pdf');
}

// ===== EXCEL =====
export function exportInventarioExcel(rows: Row[], sheetName = 'Inventario') {
  const wsData = [
    ['Artículo', 'Cantidad', 'Ubicación'],
    ...rows.map((r) => [
      r.nombre,
      Number.isFinite(r.cantidad) ? r.cantidad : 0,
      r.ubicacion?.trim() || 'Sin asignar',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'inventario.xlsx');
}
