require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const Tesseract = require('tesseract.js');
const PDFDocument = require('pdfkit');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin Setup seguro via Env Vars
if (!admin.apps.length) {
  // Tratamento da Private Key que pode conter quebras de linha
  const privateKey = process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : undefined;

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log("Firebase Admin inicializado com segurança.");
  } else {
    console.warn("AVISO: Credenciais do Firebase Admin não encontradas nas variáveis de ambiente.");
  }
}

// Acesso preguiçoso ao Firestore: evita rebentar o arranque do servidor
// quando as credenciais do Firebase Admin ainda não foram configuradas.
function getDb() {
  return admin.firestore();
}

// --- MIDDLEWARE: Verificar token de autenticação Firebase ---
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!idToken) {
    return res.status(401).json({ error: 'Token de autenticação em falta' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch (error) {
    console.error('Token inválido:', error.message);
    res.status(401).json({ error: 'Token de autenticação inválido' });
  }
}

// --- HELPER: Simple Parser for OCR text ---
function parseInvoiceText(text) {
  const result = {
    storeName: "Loja Identificada",
    storeNif: "",
    invoiceNumber: "",
    invoiceDate: "",
    totalAmount: 0,
    paymentMethod: "Dinheiro",
    items: []
  };

  const lines = text.split('\n');

  // Regex patterns
  const nifRegex = /(?:NIF|CONTRIB|CONT):?\s*(\d{9})/i;
  const totalRegex = /(?:TOTAL|VALOR TOTAL|PAGAR):?\s*(\d+[.,]\d{2})/i;
  const dateRegex = /(\d{2}[-/]\d{2}[-/]\d{4})/;
  const itemExclusionRegex = /\b(TOTAL|SUBTOTAL|IVA|NIF|TROCO|DESCONTO|PAGO)\b/i;

  lines.forEach(line => {
    // Detect NIF
    const nifMatch = line.match(nifRegex);
    if (nifMatch && !result.storeNif) result.storeNif = nifMatch[1];

    // Detect Total: ignora "SUBTOTAL" e fica com a última ocorrência
    // (o total final costuma aparecer depois de eventuais subtotais no recibo)
    if (!/SUBTOTAL/i.test(line)) {
      const totalMatch = line.match(totalRegex);
      if (totalMatch) result.totalAmount = parseFloat(totalMatch[1].replace(',', '.'));
    }

    // Detect Date
    const dateMatch = line.match(dateRegex);
    if (dateMatch && !result.invoiceDate) result.invoiceDate = dateMatch[1];

    // Try to catch items (e.g. "Product Name 1.50")
    const itemMatch = line.match(/(.+)\s+(\d+[.,]\d{2})$/);
    if (itemMatch && !itemExclusionRegex.test(line)) {
      result.items.push({
        productName: itemMatch[1].trim(),
        quantity: 1,
        unitPrice: parseFloat(itemMatch[2].replace(',', '.')),
        totalPrice: parseFloat(itemMatch[2].replace(',', '.'))
      });
    }
  });

  if (!result.invoiceDate) result.invoiceDate = new Date().toISOString().split('T')[0];

  return result;
}

// --- HELPER: Confirma que o ficheiro pertence à pasta do próprio utilizador no Storage ---
// Evita SSRF (aceitar qualquer URL arbitrário) e acesso a ficheiros de outros utilizadores.
function isOwnStorageFile(fileUrl, uid) {
  try {
    const url = new URL(fileUrl);
    if (url.hostname !== 'firebasestorage.googleapis.com') return false;
    const decodedPath = decodeURIComponent(url.pathname);
    return decodedPath.includes(`invoices/${uid}/`);
  } catch {
    return false;
  }
}

// --- ENDPOINT: OCR ---
app.post('/api/ocr/process-invoice', authenticate, async (req, res) => {
  const { fileUrl } = req.body;
  if (!fileUrl) return res.status(400).json({ error: 'URL do ficheiro é obrigatória' });
  if (!isOwnStorageFile(fileUrl, req.uid)) {
    return res.status(400).json({ error: 'URL do ficheiro inválido' });
  }

  try {
    console.log(`A processar OCR para: ${fileUrl}`);
    const { data: { text } } = await Tesseract.recognize(fileUrl, 'por');

    const extractedData = parseInvoiceText(text);
    res.json(extractedData);
  } catch (error) {
    console.error('Erro OCR:', error);
    res.status(500).json({ error: 'Falha ao processar OCR' });
  }
});

// --- ENDPOINT: PDF Report ---
app.get('/api/reports/pdf', authenticate, async (req, res) => {
  const userId = req.uid;

  try {
    const invoicesSnap = await getDb().collection('invoices')
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

// --- SERVE STATIC FRONTEND (PRODUCTION) ---
// Serve os ficheiros estáticos do React (dist)
app.use(express.static(path.join(__dirname, '../dist')));

// Qualquer outra rota não-API retorna o index.html (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API a correr na porta ${PORT}`));