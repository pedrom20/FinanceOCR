require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const Tesseract = require('tesseract.js');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const app = express();
app.use(cors());
app.use(express.json());

// Guarda os ficheiros originais no disco do próprio servidor (em vez do Firebase
// Storage, que exige o plano pago). Requer um volume persistente montado nesta
// pasta em produção, para os ficheiros sobreviverem a redeploys.
const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Dados de idioma do Tesseract incluídos no projeto (api/tessdata/por.traineddata.gz)
// em vez de descarregados do CDN da jsdelivr a cada arranque do container — isso
// causava OCR muito lento ou a falhar em produção quando a rede de saída do
// container estava limitada/instável.
const TESSDATA_DIR = path.join(__dirname, 'tessdata');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const userDir = path.join(UPLOADS_DIR, req.uid);
      fs.mkdirSync(userDir, { recursive: true });
      cb(null, userDir);
    },
    filename: (req, file, cb) => {
      const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Formato não suportado. Envie uma foto (JPG/PNG) ou um PDF da fatura.'));
  },
});

// O Tesseract só lê imagens; faturas em PDF são convertidas para PNG (1ª página)
// com o poppler (pdftoppm) antes do OCR. Requer poppler-utils instalado (já incluído
// na imagem Docker; localmente instalar com `brew install poppler` ou `apt install poppler-utils`).
async function convertPdfToImage(pdfPath) {
  const outputPrefix = `${pdfPath}-page`;
  await execFileAsync('pdftoppm', ['-png', '-r', '300', '-singlefile', pdfPath, outputPrefix]);
  return `${outputPrefix}.png`;
}

// --- ENDPOINT: Health Check (usado pelo Docker/Coolify) ---
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Firebase Admin Setup seguro via Env Vars
if (!admin.apps.length) {
  // Tratamento da Private Key: prefere FIREBASE_PRIVATE_KEY_BASE64 (a chave PEM
  // codificada em base64), que sobrevive a copy-paste em qualquer editor sem
  // risco de os hífens/quebras de linha do PEM serem corrompidos. Mantém
  // FIREBASE_PRIVATE_KEY como alternativa, removendo aspas envolventes e
  // convertendo "\n" literal em quebras de linha reais.
  const base64Key = process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  const privateKey = base64Key
    ? Buffer.from(base64Key, 'base64').toString('utf8')
    : rawPrivateKey
    ? rawPrivateKey.replace(/^"(.*)"$/s, '$1').replace(/\\n/g, '\n')
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

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Regex patterns
  // O NIF costuma aparecer com espaços entre grupos de dígitos (ex: "114 980 136"),
  // por isso captura-se dígitos+espaços e limpam-se os espaços depois.
  const nifRegex = /(?:NIF|NIPC|CONTRIB(?:UINTE)?)\D{0,8}([\d ]{9,13})/i;
  // Entre o rótulo e o valor pode haver espaços de alinhamento (talões imprimem o
  // preço encostado à direita), dois pontos ou o símbolo de euro — mas não outras
  // palavras, para não apanhar o número errado em linhas como
  // "Total da fatura de junho 58,980 ... € 72,55".
  const totalRegex = /(?:VALOR A PAGAR|TOTAL A PAGAR|VALOR TOTAL|TOTAL|PAGAR)[:\s€]*(\d+[.,]\d{2})/i;
  const dateRegex = /(\d{2}[-/]\d{2}[-/]\d{4})/;
  const itemExclusionRegex = /\b(TOTAL|SUBTOTAL|IVA|NIF|NIPC|CONTRIBUINTE|TROCO|DESCONTO|PAGO|REFER[ÊE]NCIA|CLIENTE|CONTA|IBAN|BIC|D[ÉE]BITO|PAGAMENTO|FATURA|EMISS[ÃA]O|MORADA|ATCUD|CR[ÉE]DITO)\b/i;

  // Nome da loja: normalmente é uma das primeiras linhas do cabeçalho, antes de
  // qualquer linha "administrativa" (NIF, Fatura Nº, Data, etc.). Escolhe-se a
  // primeira linha legível (maioria de letras, não só ruído do OCR) até lá.
  const storeStopRegex = /\b(NIF|NIPC|CONTRIBUINTE|FATURA|FACTURA|TAL[ÃA]O|RECIBO|ATCUD|DATA)\b/i;
  for (const line of lines.slice(0, 12)) {
    if (storeStopRegex.test(line)) break;
    const letters = (line.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    if (letters >= 3 && letters / line.length >= 0.5) {
      result.storeName = line;
      break;
    }
  }

  // Nas faturas em PDF o cabeçalho é muitas vezes um logótipo, que o OCR lê como
  // ruído ilegível antes de qualquer linha "administrativa" — a heurística acima
  // falha nesses casos. Como alternativa, procura-se um domínio (ex: "meo.pt")
  // no texto, que costuma aparecer no rodapé/contactos e identifica a empresa.
  if (result.storeName === 'Loja Identificada') {
    const domainMatch = text.match(/\b([a-z][a-z0-9-]{1,20})\.(?:pt|com|eu)\b/i);
    if (domainMatch) result.storeName = domainMatch[1].toUpperCase();
  }

  lines.forEach(line => {
    // Detect NIF
    const nifMatch = line.match(nifRegex);
    if (nifMatch && !result.storeNif) {
      const digits = nifMatch[1].replace(/\D/g, '');
      if (digits.length === 9) result.storeNif = digits;
    }

    // Detect Total: ignora "SUBTOTAL" e fica com a última ocorrência
    // (o total final costuma aparecer depois de eventuais subtotais no recibo)
    if (!/SUBTOTAL/i.test(line)) {
      const totalMatch = line.match(totalRegex);
      if (totalMatch) result.totalAmount = parseFloat(totalMatch[1].replace(',', '.'));
    }

    // Detect Date: converte DD/MM/AAAA ou DD-MM-AAAA para AAAA-MM-DD, formato
    // exigido pelo <input type="date"> do formulário de confirmação.
    const dateMatch = line.match(dateRegex);
    if (dateMatch && !result.invoiceDate) {
      const [day, month, year] = dateMatch[1].split(/[-/]/);
      result.invoiceDate = `${year}-${month}-${day}`;
    }

    // Try to catch items (e.g. "Product Name 1.50")
    const itemMatch = line.match(/(.+?)\s+(\d+[.,]\d{2})$/);
    if (itemMatch && !itemExclusionRegex.test(line)) {
      const productName = itemMatch[1].trim().replace(/\s{2,}/g, ' ');
      const price = parseFloat(itemMatch[2].replace(',', '.'));
      const lettersInName = (productName.match(/[A-Za-zÀ-ÿ]/g) || []).length;
      // Só aceita linhas que pareçam mesmo um produto: nome com letras reais
      // e preço num intervalo plausível (evita apanhar nºs de referência, etc.)
      if (lettersInName >= 3 && price > 0 && price < 10000) {
        result.items.push({
          productName,
          quantity: 1,
          unitPrice: price,
          totalPrice: price
        });
      }
    }
  });

  if (!result.invoiceDate) result.invoiceDate = new Date().toISOString().split('T')[0];

  return result;
}

// --- ENDPOINT: OCR ---
app.post('/api/ocr/process-invoice', authenticate, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Ficheiro é obrigatório' });

  let ocrImagePath = req.file.path;
  let convertedPath = null;

  try {
    console.log(`A processar OCR para utilizador ${req.uid} (${req.file.originalname}, ${req.file.size} bytes)`);

    if (req.file.mimetype === 'application/pdf') {
      convertedPath = await convertPdfToImage(req.file.path);
      ocrImagePath = convertedPath;
    }

    const { data: { text } } = await Tesseract.recognize(ocrImagePath, 'por', {
      langPath: TESSDATA_DIR,
      cacheMethod: 'none',
      gzip: true,
    });

    console.log(`Texto OCR (${text.length} chars) para ${req.uid}:\n${text}`);

    const extractedData = parseInvoiceText(text);
    res.json({ ...extractedData, fileName: req.file.filename });
  } catch (error) {
    console.error('Erro OCR:', error);
    res.status(500).json({ error: 'Falha ao processar OCR' });
  } finally {
    if (convertedPath) fs.unlink(convertedPath, () => {});
  }
});

// --- ENDPOINT: Descarregar o ficheiro original de uma fatura ---
app.get('/api/files/:fileName', authenticate, (req, res) => {
  const safeFileName = path.basename(req.params.fileName);
  const filePath = path.join(UPLOADS_DIR, req.uid, safeFileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Ficheiro não encontrado' });
  }
  res.sendFile(filePath);
});

// --- ENDPOINT: Guardar Fatura ---
// A escrita é feita aqui pelo servidor (via firebase-admin) em vez de
// diretamente do browser para o Firestore: a ligação direta browser→Firestore
// (WebSocket ou long-polling) tem-se mostrado bloqueada em alguns
// browsers/redes de utilizadores, deixando a gravação presa sem erro nem
// sucesso. O servidor já fala com o Firestore sem problemas (usado no
// endpoint de relatório), por isso evita essa dependência da rede do cliente.
app.post('/api/invoices', authenticate, async (req, res) => {
  const { items, ...invoiceData } = req.body || {};

  if (typeof invoiceData.storeName !== 'string' || typeof invoiceData.totalAmount !== 'number') {
    return res.status(400).json({ error: 'Dados da fatura inválidos' });
  }

  try {
    const db = getDb();
    const docRef = await db.collection('invoices').add({
      ...invoiceData,
      userId: req.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (Array.isArray(items) && items.length > 0) {
      const batch = db.batch();
      items.forEach(item => {
        const itemRef = docRef.collection('invoiceItems').doc();
        batch.set(itemRef, item);
      });
      await batch.commit();
    }

    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error('Erro ao guardar fatura:', error);
    res.status(500).json({ error: 'Falha ao guardar fatura' });
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