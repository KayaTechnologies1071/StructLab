import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // 1200 - 1500 pixels as requested
        await page.setViewport({ width: 1400, height: 1200 });

        console.log('Navigating to local site...');
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

        console.log('Opening Help Modal...');
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const docsBtn = btns.find(b => b.title === 'Docs');
            if (docsBtn) docsBtn.click();
        });

        // Wait for modal to appear
        await page.waitForSelector('.max-w-5xl', { visible: true });

        // Remove scrollbars and max-height so the whole modal can be captured cleanly
        await page.evaluate(() => {
            const modal = document.querySelector('.max-w-5xl');
            if (modal) {
                modal.classList.remove('max-h-[85vh]', 'h-full');
                modal.style.height = 'auto'; // allow it to expand
            }

            const scrollArea = document.querySelector('.overflow-y-auto');
            if (scrollArea) {
                scrollArea.classList.remove('overflow-y-auto');
                scrollArea.style.overflow = 'visible';
                scrollArea.style.height = 'auto';
            }
        });

        // Wait a bit for layout to settle
        await new Promise(r => setTimeout(r, 1000));

        const modalElement = await page.$('.max-w-5xl');

        console.log('Taking Beam Analysis screenshot...');
        await modalElement.screenshot({ path: path.join(process.cwd(), 'StructLab_BeamAnalysis_Docs.png') });
        console.log('Saved: StructLab_BeamAnalysis_Docs.png');

        console.log('Switching to Frame Analysis Tab...');
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const frameBtn = btns.find(b => b.textContent && b.textContent.includes('Çerçeve'));
            if (frameBtn) frameBtn.click();
        });

        await new Promise(r => setTimeout(r, 1000));

        console.log('Taking Truss Analysis screenshot...');
        await modalElement.screenshot({ path: path.join(process.cwd(), 'StructLab_FrameAnalysis_Docs.png') });
        console.log('Saved: StructLab_FrameAnalysis_Docs.png');

        await browser.close();
        console.log('Done!');
    } catch (error) {
        console.error('Error taking screenshots:', error);
        process.exit(1);
    }
})();
