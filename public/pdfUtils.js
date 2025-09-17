export function createPDFHeader(doc, customer, project, additionalLines = []) {
    const pageWidth = doc.internal.pageSize.getWidth();
    // Logo and company info block
    doc.addImage('CKS Logo.png', 'PNG', 10, 10, 16, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Commercial Kitchen Solutions', 30, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('13326 N Dysart Rd. Suite #160', 30, 21);
    doc.text('Surprise, AZ 85379', 30, 26);

    // Customer info box (shaded)
    let y = 16;
    // PMS 872 gold at 30% print strength: RGB(205, 191, 170)
        doc.setFillColor(205, 191, 170);
    const leftMargin = 120;
        doc.roundedRect(leftMargin, y, 70, 28, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(customer || '', leftMargin + 35, y + 7, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        let infoY = y + 13;
        additionalLines.forEach(line => {
            if (line) {
                doc.text(line, leftMargin + 35, infoY, { align: 'center' });
                infoY += 5;
            }
        });
        return y + 30;
}

export function createPDFTable(doc, startY, head, body, columnStyles, headerFontSize = 11) {
    doc.autoTable({
        startY,
        head,
        body,
        theme: 'grid',
        headStyles: { fillColor: [205, 191, 170], textColor: [0, 0, 0], fontSize: headerFontSize, fontStyle: 'bold' },
        bodyStyles: { fontSize: 10, cellPadding: 2, fillColor: [255,255,255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles,
        margin: { left: 16, right: 16 },
        styles: { halign: 'center', valign: 'middle', font: 'helvetica' }
    });
    return doc.lastAutoTable.finalY;
}