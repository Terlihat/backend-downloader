const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();

// Mengizinkan GitHub Pages Anda mengakses API ini
app.use(cors());
app.use(express.json());

app.post('/api/download', async (req, res) => {
    const targetUrl = req.body.url;
    
    // Mengekstrak ID Dokumen dari link Scribd
    const scribdRegex = /(?:doc|document)\/(\d+)/;
    const match = targetUrl?.match(scribdRegex);

    if (!targetUrl || !match) {
        return res.status(400).json({ error: "URL Scribd tidak valid." });
    }

    const docId = match[1];
    const embedUrl = `https://www.scribd.com/embeds/${docId}/content`;

    let browser;
    try {
        // Membuka "Browser Tersembunyi" (Headless Chrome)
        browser = await puppeteer.launch({ 
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ] 
        });
        
        const page = await browser.newPage();
        
        // Pergi ke halaman dokumen bersih tanpa iklan
        await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Simulasi scroll ke bawah agar seluruh gambar/halaman dokumen termuat
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 500;
                let timer = setInterval(() => {
                    let scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 200); // Scroll setiap 200 milidetik
            });
        });

        // Merakit dan mencetak halaman menjadi format PDF
        const pdfBuffer = await page.pdf({ 
            format: 'A4', 
            printBackground: true,
            margin: { top: '10px', bottom: '10px', left: '10px', right: '10px' }
        });

        await browser.close();

        // Mengirimkan file PDF kembali ke pengguna (Browser)
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
            'Content-Disposition': `attachment; filename="Scribd_Doc_${docId}.pdf"`
        });

        res.send(pdfBuffer);

    } catch (error) {
        if (browser) await browser.close();
        console.error(error);
        res.status(500).json({ error: "Gagal merakit PDF. Server Render sedang sibuk." });
    }
});

// Menjalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server DocDownloader berjalan di port ${PORT}`);
});
