export const exportSvgAsPng = (svgElement: SVGSVGElement | null, filename: string, backgroundColor = '#0f172a') => {
    if (!svgElement) return;

    try {
        // Clone the SVG element so we don't modify the live DOM temporarily
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

        // Ensure the cloned SVG has exact pixel dimensions for the canvas to rasterize
        const { width, height } = svgElement.getBoundingClientRect();
        clonedSvg.setAttribute('width', width.toString());
        clonedSvg.setAttribute('height', height.toString());

        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.crossOrigin = "anonymous";

        // Create an SVG blob
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            // High-resolution export (2x scale)
            const scale = 2;
            canvas.width = width * scale;
            canvas.height = height * scale;

            if (ctx) {
                // Fill background
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Draw image scaled
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // --- Draw Promotional Watermark ---
                const padding = 24 * scale;
                const textX = canvas.width - padding;
                const textY = canvas.height - padding;

                // 1. Draw URL
                ctx.font = `500 ${11 * scale}px monospace`;
                ctx.fillStyle = "rgba(148, 163, 184, 0.5)"; // slate-400
                ctx.textAlign = "right";
                ctx.textBaseline = "bottom";
                ctx.fillText("StructLab.kayasuleyman.com", textX, textY);

                // 2. Draw "StructLab" Brand
                ctx.font = `bold ${18 * scale}px sans-serif`;
                ctx.fillStyle = "rgba(241, 245, 249, 0.4)"; // slate-100
                ctx.fillText("StructLab", textX, textY - 16 * scale);
                const brandWidth = ctx.measureText("StructLab").width;

                // 3. Draw Activity Logo Icon
                ctx.save();
                const iconSize = 24;
                const iconScale = scale * 0.9;
                const iconX = textX - brandWidth - (iconSize * iconScale) - 6 * scale;
                const iconY = textY - 16 * scale - (iconSize * iconScale) + 6 * scale;

                ctx.translate(iconX, iconY);
                ctx.scale(iconScale, iconScale);
                const path = new Path2D("M22 12h-4l-3 9L9 3l-3 9H2");
                ctx.strokeStyle = "rgba(59, 130, 246, 0.5)"; // blue-500
                ctx.lineWidth = 2.5;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.stroke(path);
                ctx.restore();
            }

            URL.revokeObjectURL(url);

            // Trigger download
            const pngUrl = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = `${filename}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        img.onerror = (e) => {
            console.error('Error generating image from SVG', e);
            URL.revokeObjectURL(url);
        };

        img.src = url;
    } catch (e) {
        console.error('Export failed:', e);
    }
};
