import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export interface Row { id:number; nombre:string; cantidad:number }

export function exportInventarioPDF(rows: Row[], title = 'Inventario General'){
  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.text(title, 14, 22)
  const body = rows.map(r => [String(r.id), r.nombre, r.cantidad.toLocaleString()])
  autoTable(doc, { head: [['ID','Artículo','Cantidad']], body, startY: 30, styles:{ fontSize:10 }, headStyles:{ fillColor:[199,0,0] } })
  doc.save('inventario.pdf')
}

export function exportInventarioExcel(rows: Row[], sheetName = 'Inventario'){
  const wsData = [['ID','Artículo','Cantidad'], ...rows.map(r => [r.id, r.nombre, r.cantidad])]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'inventario.xlsx')
}
