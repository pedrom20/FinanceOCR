const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const Tesseract = require('tesseract.js');
const PDFDocument = require('pdfkit');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin Setup (Assuming env variables or serviceAccount.json)
// Em produção, as credenciais devem vir de variáveis de ambiente
if (!admin.apps.length) {
  admin.initializeApp({
    // credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    // databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();

// --- HELPER: Simple Parser for OCR text ---
function parseInvoiceText(text) {
  const result = {
    storeName: "Loja Identificada",
    storeNif: "",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split('T')[0],
    totalAmount: 0,
    paymentMethod: "Dinheiro",
    items: []
  };

  const lines = text.split('\n');
  
  // Regex patterns
  const nifRegex = /(?:NIF|CONTRIB|CONT):?\s*(\d{9})/i;
  const totalRegex = /(?:TOTAL|VALOR TOTAL|PAGAR):?\s*(\d+[.,]\d{2})/i;
  const dateRegex = /(\d{2}[-/]\d{2}[-/]\d{4})/;

  lines.forEach(line => {
    // Detect NIF
    const nifMatch = line.match(nifRegex);
    if (nifMatch && !result.storeNif) result.storeNif = nifMatch[1];

    // Detect Total
    const totalMatch = line.match(totalRegex);
    if (totalMatch && !result.totalAmount) result.totalAmount = parseFloat(totalMatch[1].replace(',', '.'));

    // Detect Date
    const dateMatch = line.match(dateRegex);
    if (dateMatch && !result.invoiceDate) result.invoiceDate = dateMatch[1];

    // Try to catch items (e.g. "Product Name 1.50")
    const itemMatch = line.match(/(.+)\s+(\d+[.,]\d{2})$/);
    if (itemMatch && !line.includes('TOTAL')) {
      result.items.push({
        productName: itemMatch[1].trim(),
        quantity: 1,
        unitPrice: parseFloat(itemMatch[2].replace(',', '.')),
        totalPrice: parseFloat(itemMatch[2].replace(',', '.'))
      });
    }
  });

  return result;
}

// --- ENDPOINT: OCR ---
app.post('/api/ocr/process-invoice', async (req, res) => {
  const { fileUrl } = req.body;
  if (!fileUrl) return res.status(400).json({ error: 'URL do ficheiro é obrigatória' });

  try {
    console.log(`A processar OCR para: ${fileUrl}`);
    const { data: { text } } = await Tesseract.recognize(fileUrl, 'por', {
      // logger: m => console.log(m)
    });

    const extractedData = parseInvoiceText(text);
    res.json(extractedData);
  } catch (error) {
    console.error('Erro OCR:', error);
    res.status(500).json({ error: 'Falha ao processar OCR' });
  }
});

// --- ENDPOINT: PDF Report ---
app.get('/api/reports/pdf', async (req, res) => {
  const { userId, startDate, endDate } = req.query;

  try {
    const invoicesSnap = await db.collection('invoices')
      .where('userId', '==', userId)
      .get();

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio-finocr.pdf');
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('FinOCR - Relatório de Despesas', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Utilizador ID: ${userId}`);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-PT')}`);
    doc.moveDown();

    // Table Header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Data', 50, doc.y, { continued: true }).text('Loja', 150, doc.y, { continued: true }).text('Valor', 450, doc.y);
    doc.font('Helvetica').moveDown(0.5);
    doc.rect(50, doc.y, 500, 1).fill('#ccc');
    doc.moveDown();

    let total = 0;
    invoicesSnap.forEach(docSnap => {
      const inv = docSnap.data();
      doc.text(inv.invoiceDate || 'N/A', 50, doc.y, { continued: true })
         .text(inv.storeName || 'Desconhecido', 150, doc.y, { continued: true })
         .text(`${inv.totalAmount?.toFixed(2)} €`, 450, doc.y);
      total += inv.totalAmount || 0;
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text(`TOTAL GERAL: ${total.toFixed(2)} €`, { align: 'right' });

    doc.end();
  } catch (error) {
    console.error('Erro PDF:', error);
    res.status(500).send('Erro ao gerar PDF');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API a correr na porta ${PORT}`));
